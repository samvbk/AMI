import { Phone, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EmergencyOverlay({ message, onClose }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 z-[100] bg-red-700 text-white flex items-center justify-center p-6"
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/15 hover:bg-white/25"
            aria-label="Close emergency alert"
          >
            <X className="w-7 h-7" />
          </button>

          <div className="max-w-3xl text-center">
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="mx-auto mb-8 w-20 h-20 rounded-full bg-white/15 flex items-center justify-center"
            >
              <Phone className="w-11 h-11" />
            </motion.div>
            <h1 className="text-4xl md:text-6xl font-black mb-6">Emergency Alert</h1>
            <p className="text-xl md:text-2xl leading-relaxed mb-10">{message}</p>
            <a
              href="tel:112"
              className="inline-flex items-center justify-center gap-3 px-10 py-5 rounded-2xl bg-white text-red-700 text-2xl font-black shadow-2xl hover:bg-red-50"
            >
              <Phone className="w-8 h-8" />
              Call 112
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
