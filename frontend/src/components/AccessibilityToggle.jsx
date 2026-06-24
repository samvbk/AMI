import { useState, useEffect } from 'react';
import { Eye, Type, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AccessibilityToggle() {
  const [isOpen, setIsOpen] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);

  useEffect(() => {
    // Apply High Contrast
    if (highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }

    // Apply Large Text
    if (largeText) {
      document.body.classList.add('large-text');
    } else {
      document.body.classList.remove('large-text');
    }
  }, [highContrast, largeText]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-full font-bold"
        style={{ background: '#FFFFFF', color: '#4A86CF' }}
        title="Accessibility Settings"
        aria-label="Toggle Accessibility Menu"
        aria-expanded={isOpen}
      >
        <Eye size={20} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#D6E2F0] rounded-2xl shadow-xl p-4 z-50"
          >
            <h3 className="text-sm font-bold text-[#333333] mb-3 border-b border-[#EBF3FC] pb-2">
              Accessibility Options
            </h3>
            
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-2 text-sm text-[#5A85B0]">
                  <Eye size={16} /> High Contrast
                </span>
                <input 
                  type="checkbox" 
                  checked={highContrast} 
                  onChange={() => setHighContrast(!highContrast)}
                  className="w-4 h-4 accent-[#4A86CF]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="flex items-center gap-2 text-sm text-[#5A85B0]">
                  <Type size={16} /> Large Text
                </span>
                <input 
                  type="checkbox" 
                  checked={largeText} 
                  onChange={() => setLargeText(!largeText)}
                  className="w-4 h-4 accent-[#4A86CF]"
                />
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
