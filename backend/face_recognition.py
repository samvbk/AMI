import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import cv2
import numpy as np
from crypto import decrypt_data

try:
    from insightface.app import FaceAnalysis
except Exception:  # pragma: no cover - handled at runtime with a clear message
    FaceAnalysis = None


EMBEDDING_DIM = 512
EMBEDDING_BYTES = EMBEDDING_DIM * 4
FALLBACK_EMBEDDING_DIM = 64 * 64
FALLBACK_EMBEDDING_BYTES = FALLBACK_EMBEDDING_DIM * 4
MIN_BRIGHTNESS = 55
MIN_FACE_BLUR_SCORE = 25


@dataclass
class DetectedFace:
    bbox: np.ndarray
    embedding: np.ndarray
    det_score: float = 1.0


@dataclass
class FaceQualityResult:
    quality: str
    message: str
    metrics: Dict[str, Any]
    face: Optional[Any] = None
    image: Optional[np.ndarray] = None

    @property
    def success(self) -> bool:
        return self.quality == "good"


class FaceRecognitionService:
    """InsightFace/ArcFace based face recognition helper."""

    def __init__(self, db, logger: Optional[logging.Logger] = None):
        self.db = db
        self.logger = logger or logging.getLogger(__name__)
        self._model = None
        self._cascade = None
        self._engine = "insightface" if FaceAnalysis is not None else "opencv"

    def _get_model(self):
        if FaceAnalysis is None:
            raise RuntimeError(
                "InsightFace is not installed. Run `pip install insightface onnxruntime`."
            )

        if self._model is None:
            self.logger.info("Loading InsightFace buffalo_l model for ArcFace embeddings")
            self._model = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
            self._model.prepare(ctx_id=-1, det_size=(640, 640))

        return self._model

    def _get_cascade(self):
        if self._cascade is None:
            cascade_path = Path(__file__).with_name("haarcascade_frontalface_default.xml")
            if not cascade_path.exists():
                cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"

            self._cascade = cv2.CascadeClassifier(str(cascade_path))
            if self._cascade.empty():
                raise RuntimeError(f"Could not load face detector cascade: {cascade_path}")

        return self._cascade

    def _fallback_embedding(self, gray: np.ndarray, bbox: np.ndarray) -> np.ndarray:
        height, width = gray.shape[:2]
        x1, y1, x2, y2 = bbox.astype(int)
        x1 = max(0, min(x1, width - 1))
        y1 = max(0, min(y1, height - 1))
        x2 = max(x1 + 1, min(x2, width))
        y2 = max(y1 + 1, min(y2, height))

        face_gray = gray[y1:y2, x1:x2]
        face_gray = cv2.equalizeHist(face_gray)
        face_gray = cv2.resize(face_gray, (64, 64), interpolation=cv2.INTER_AREA)
        embedding = face_gray.astype(np.float32).flatten() / 255.0
        embedding -= float(np.mean(embedding))
        norm = np.linalg.norm(embedding)
        return embedding / norm if norm else embedding

    def _get_faces(self, image: np.ndarray, gray: np.ndarray) -> Tuple[list, str]:
        if FaceAnalysis is not None:
            try:
                return self._get_model().get(image), "insightface"
            except Exception as exc:
                self.logger.warning("InsightFace failed; using OpenCV fallback: %s", exc)

        faces = self._get_cascade().detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(80, 80),
        )

        detected_faces = []
        for x, y, w, h in faces:
            bbox = np.array([x, y, x + w, y + h], dtype=np.float32)
            detected_faces.append(
                DetectedFace(
                    bbox=bbox,
                    embedding=self._fallback_embedding(gray, bbox),
                    det_score=1.0,
                )
            )

        return detected_faces, "opencv"

    def decode_image(self, image_bytes: bytes) -> Optional[np.ndarray]:
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return image

    def check_quality(self, image_bytes: bytes) -> FaceQualityResult:
        image = self.decode_image(image_bytes)
        if image is None:
            return FaceQualityResult(
                "invalid",
                "Could not read the image. Please try again.",
                {},
            )

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        brightness = float(np.mean(gray))
        frame_blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        height, width = image.shape[:2]
        frame_area = float(width * height)

        metrics: Dict[str, Any] = {
            "brightness": round(brightness, 2),
            "blur_score": round(frame_blur_score, 2),
            "face_count": 0,
        }

        if brightness < MIN_BRIGHTNESS:
            return FaceQualityResult(
                "too_dark",
                "Too dark. Please move to better lighting.",
                metrics,
                image=image,
            )

        try:
            faces, engine = self._get_faces(image, gray)
        except Exception as exc:
            self.logger.error("Face quality check failed: %s", exc)
            return FaceQualityResult(
                "unavailable",
                "Face detector is not available. Please check backend setup.",
                metrics,
                image=image,
            )

        metrics["engine"] = engine
        metrics["face_count"] = len(faces)

        if not faces:
            return FaceQualityResult(
                "no_face",
                "No face detected. Please face the camera directly.",
                metrics,
                image=image,
            )

        if len(faces) > 1:
            return FaceQualityResult(
                "multiple_faces",
                "Multiple faces detected. Please register one person at a time.",
                metrics,
                image=image,
            )

        face = faces[0]
        x1, y1, x2, y2 = face.bbox.astype(int)
        x1 = max(0, min(x1, width - 1))
        y1 = max(0, min(y1, height - 1))
        x2 = max(x1 + 1, min(x2, width))
        y2 = max(y1 + 1, min(y2, height))

        face_area = max(0, x2 - x1) * max(0, y2 - y1)
        face_ratio = face_area / frame_area if frame_area else 0
        metrics["face_area_ratio"] = round(face_ratio, 4)
        metrics["detection_score"] = round(float(getattr(face, "det_score", 0)), 4)

        face_gray = gray[y1:y2, x1:x2]
        face_blur_score = float(cv2.Laplacian(face_gray, cv2.CV_64F).var())
        metrics["face_blur_score"] = round(face_blur_score, 2)

        if face_ratio < 0.08:
            return FaceQualityResult(
                "too_far",
                "Face is too small. Move closer to the camera.",
                metrics,
                face=face,
                image=image,
            )

        if face_blur_score < MIN_FACE_BLUR_SCORE:
            return FaceQualityResult(
                "blurry",
                "Face looks a little soft. Hold still and try again.",
                metrics,
                face=face,
                image=image,
            )

        return FaceQualityResult(
            "good",
            "Good face quality.",
            metrics,
            face=face,
            image=image,
        )

    def extract_embedding(self, image_bytes: bytes) -> Tuple[Optional[bytes], FaceQualityResult]:
        quality = self.check_quality(image_bytes)
        if not quality.success or quality.face is None:
            return None, quality

        embedding = np.asarray(quality.face.embedding, dtype=np.float32)
        norm = np.linalg.norm(embedding)
        if embedding.shape[0] not in (EMBEDDING_DIM, FALLBACK_EMBEDDING_DIM) or norm == 0:
            return None, FaceQualityResult(
                "invalid_embedding",
                "Could not create a valid face embedding. Please try again.",
                quality.metrics,
                image=quality.image,
            )

        embedding = embedding / norm
        return embedding.astype(np.float32).tobytes(), quality

    def _load_known_faces(self) -> Dict[int, Dict[str, Any]]:
        rows = self.db.execute_query(
            """
            SELECT m.id, m.name, m.face_encoding, f.family_name
            FROM members m
            JOIN families f ON m.family_id = f.id
            WHERE m.face_encoding IS NOT NULL
            """,
            fetch_all=True,
        ) or []

        known: Dict[int, Dict[str, Any]] = {}
        for row in rows:
            blob = row.get("face_encoding")
            if not blob:
                continue

            blob = decrypt_data(blob)

            if len(blob) == EMBEDDING_BYTES:
                embedding = np.frombuffer(blob, dtype=np.float32)
                kind = "insightface"
            elif len(blob) == FALLBACK_EMBEDDING_BYTES:
                embedding = np.frombuffer(blob, dtype=np.float32)
                kind = "opencv"
            else:
                self.logger.warning(
                    "Skipping incompatible face encoding for member %s; re-registration required",
                    row.get("id"),
                )
                continue

            known[row["id"]] = {
                "name": row["name"],
                "family_name": row["family_name"],
                "embedding": embedding,
                "kind": kind,
            }

        return known

    def recognize(self, image_bytes: bytes, threshold: float = 0.5) -> Tuple[Optional[Dict[str, Any]], FaceQualityResult, list]:
        embedding_bytes, quality = self.extract_embedding(image_bytes)
        if embedding_bytes is None:
            return None, quality, []

        input_embedding = np.frombuffer(embedding_bytes, dtype=np.float32)
        input_kind = "insightface" if len(embedding_bytes) == EMBEDDING_BYTES else "opencv"
        if input_kind == "opencv":
            threshold = 0.72

        known_faces = self._load_known_faces()

        all_matches = []
        for member_id, data in known_faces.items():
            if data.get("kind") != input_kind:
                continue

            similarity = float(np.dot(input_embedding, data["embedding"]))
            all_matches.append({
                "member_id": member_id,
                "name": data["name"],
                "family_name": data["family_name"],
                "confidence": similarity,
            })

        all_matches.sort(key=lambda x: x["confidence"], reverse=True)
        top_matches = [m for m in all_matches[:3] if m["confidence"] > 0.3] # filter low confidence
        
        best_match = top_matches[0] if top_matches and top_matches[0]["confidence"] >= threshold else None

        if best_match:
            self.db.execute_query(
                "UPDATE members SET last_seen = NOW() WHERE id = %s",
                (best_match["member_id"],),
                commit=True,
            )
            return best_match, quality, top_matches

        return None, quality, top_matches
