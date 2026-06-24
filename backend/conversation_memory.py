from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    from gemini_simple import generate_member_summary
except Exception:  # Avoid hard failure during tooling/import checks.
    generate_member_summary = None


class DBConversationMemory:
    def __init__(self, db, logger=None):
        self.db = db
        self.logger = logger

    def add_conversation(self, member_id: int, user_message: str, assistant_response: str, emotion: str) -> None:
        self.db.execute_query(
            """
            INSERT INTO conversations (member_id, message, response, emotion)
            VALUES (%s, %s, %s, %s)
            """,
            (member_id, user_message, assistant_response, emotion),
            commit=True,
        )
        self._maybe_update_summary(member_id)

    def get_recent_messages(self, member_id: int, limit: int = 5) -> List[Dict[str, Any]]:
        rows = self.db.execute_query(
            """
            SELECT message, response, emotion, created_at
            FROM conversations
            WHERE member_id = %s
            ORDER BY created_at DESC, id DESC
            LIMIT %s
            """,
            (member_id, limit),
            fetch_all=True,
        ) or []
        return list(reversed(rows))

    def get_member_summary(self, member_id: int) -> str:
        row = self.db.execute_query(
            "SELECT summary FROM member_summaries WHERE member_id = %s",
            (member_id,),
            fetch_one=True,
        )
        return row["summary"] if row and row.get("summary") else ""

    def get_prompt_context(self, member_id: int) -> str:
        summary = self.get_member_summary(member_id)
        recent = self.get_recent_messages(member_id, limit=5)

        parts = []
        if summary:
            parts.append(f"LONG-TERM MEMBER SUMMARY:\n{summary}")

        if recent:
            lines = ["LAST 5 MESSAGES:"]
            for item in recent:
                lines.append(f"User: {item['message']}")
                lines.append(f"Assistant: {item['response']}")
            parts.append("\n".join(lines))

        return "\n\n".join(parts)

    def get_member_preferences(self, member_id: int) -> Dict[str, Any]:
        recent = self.get_recent_messages(member_id, limit=20)
        topic_count: Dict[str, int] = {}

        for conv in recent:
            msg = (conv.get("message") or "").lower()
            if any(word in msg for word in ["weather", "temperature", "rain", "sunny"]):
                topic_count["weather"] = topic_count.get("weather", 0) + 1
            if any(word in msg for word in ["news", "headline", "update"]):
                topic_count["news"] = topic_count.get("news", 0) + 1
            if any(word in msg for word in ["health", "doctor", "medicine", "pain", "fever"]):
                topic_count["health"] = topic_count.get("health", 0) + 1
            if any(word in msg for word in ["family", "home", "house"]):
                topic_count["family"] = topic_count.get("family", 0) + 1

        sorted_topics = sorted(topic_count.items(), key=lambda x: x[1], reverse=True)[:3]
        return {
            "frequent_topics": [topic for topic, _ in sorted_topics],
            "conversation_count": len(recent),
            "last_interaction": recent[-1]["created_at"].isoformat()
            if recent and isinstance(recent[-1].get("created_at"), datetime)
            else None,
        }

    def _maybe_update_summary(self, member_id: int) -> None:
        row = self.db.execute_query(
            "SELECT COUNT(*) AS count FROM conversations WHERE member_id = %s",
            (member_id,),
            fetch_one=True,
        )
        count = int(row["count"]) if row and row.get("count") is not None else 0
        if count == 0 or count % 10 != 0:
            return

        recent = self.get_recent_messages(member_id, limit=20)
        existing_summary = self.get_member_summary(member_id)
        transcript = "\n".join(
            f"User: {item['message']}\nAssistant: {item['response']}" for item in recent
        )

        if generate_member_summary is None:
            new_summary = existing_summary or transcript[-2000:]
        else:
            try:
                new_summary = generate_member_summary(existing_summary, transcript)
            except Exception as exc:
                if self.logger:
                    self.logger.warning("Could not update member summary: %s", exc)
                return

        self.db.execute_query(
            """
            INSERT INTO member_summaries (member_id, summary, updated_at)
            VALUES (%s, %s, NOW())
            ON DUPLICATE KEY UPDATE summary = VALUES(summary), updated_at = NOW()
            """,
            (member_id, new_summary),
            commit=True,
        )
