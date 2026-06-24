import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, X, Check, User } from 'lucide-react';
import { checkFaceQuality } from '../services/api';

export default function CameraComponent({ onCapture, onClose, mode = 'recognize' }) {
  const webcamRef = useRef(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const [isProcessing, setIsProcessing] = useState(false);
  const [quality, setQuality] = useState({ quality: 'checking', message: 'Checking face quality...' });

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: facingMode,
  };

  const capture = () => {
    if (mode !== 'recognize' && quality.quality !== 'good') {
      alert(quality.message || 'Please improve face quality before capture.');
      return;
    }
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
    }
  };

  const confirmCapture = async () => {
    if (capturedImage) {
      setIsProcessing(true);
      try {
        // Pass the base64 image directly
        await onCapture(capturedImage);
        // Don't close automatically - let the parent handle it
      } catch (error) {
        console.error('Error in capture:', error);
        alert('Failed to process image. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const retake = () => {
    setCapturedImage(null);
  };

  const toggleCamera = () => {
    setFacingMode(facingMode === 'user' ? 'environment' : 'user');
  };

  useEffect(() => {
    setIsCameraOn(true);
    return () => setIsCameraOn(false);
  }, []);

  useEffect(() => {
    if (!isCameraOn || capturedImage) return undefined;

    let cancelled = false;
    const runCheck = async () => {
      const imageSrc = webcamRef.current?.getScreenshot();
      if (!imageSrc || cancelled) return;
      const result = await checkFaceQuality(imageSrc);
      if (!cancelled) setQuality(result);
    };

    runCheck();
    const timer = setInterval(runCheck, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isCameraOn, capturedImage, facingMode]);

  const qualityStyles = {
    good: 'bg-green-100 text-green-800 border-green-200',
    too_dark: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    no_face: 'bg-red-100 text-red-800 border-red-200',
    multiple_faces: 'bg-red-100 text-red-800 border-red-200',
    blurry: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    too_far: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    checking: 'bg-blue-100 text-blue-800 border-blue-200',
    unavailable: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl p-6 max-w-2xl w-full shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-purple-800">
            {mode === 'recognize' ? 'Face Recognition' : 'Register Face'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-purple-100 rounded-full transition-colors"
            disabled={isProcessing}
          >
            <X className="w-6 h-6 text-purple-600" />
          </button>
        </div>

        <div className="mb-6 relative">
          {isCameraOn && !capturedImage && (
            <>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                className="rounded-xl w-full h-auto border-4 border-purple-200"
              />
              <div className={`absolute top-4 left-4 border px-4 py-2 rounded-full text-sm font-bold ${qualityStyles[quality.quality] || qualityStyles.unavailable}`}>
                {quality.quality === 'good' ? 'Good' : quality.message || 'Checking face quality...'}
              </div>
            </>
          )}

          {capturedImage && (
            <div className="relative">
              <img
                src={capturedImage}
                alt="Captured"
                className="rounded-xl w-full h-auto border-4 border-green-200"
              />
              {isProcessing && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-xl flex items-center justify-center">
                  <div className="text-white text-lg font-semibold flex items-center gap-2">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </div>
                </div>
              )}
            </div>
          )}

          {!capturedImage && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
              <button
                onClick={capture}
                disabled={mode !== 'recognize' && quality.quality !== 'good'}
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
              >
                <Camera className="w-8 h-8" />
              </button>
              <button
                onClick={toggleCamera}
                className="bg-white text-purple-600 p-3 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
              >
                <User className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>

        {capturedImage ? (
          <div className="flex gap-4">
            <button
              onClick={retake}
              disabled={isProcessing}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 px-6 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <X className="w-5 h-5" />
              Retake
            </button>
            <button
              onClick={confirmCapture}
              disabled={isProcessing}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 px-6 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Confirm
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              {mode === 'recognize' 
                ? 'Position your face in the frame for recognition'
                : 'Make sure your face is clearly visible for registration'}
            </p>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Ensure good lighting and look directly at the camera for best results.
          </p>
        </div>
      </div>
    </div>
  );
}
