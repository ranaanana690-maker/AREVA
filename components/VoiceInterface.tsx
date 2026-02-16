import React from 'react';
import { UseLiveReturn } from '../hooks/useLive';

interface VoiceInterfaceProps {
  live: UseLiveReturn;
  onClose: () => void;
}

const VoiceInterface: React.FC<VoiceInterfaceProps> = ({ live, onClose }) => {
  const { isConnected, volume, error } = live;

  // Visualizer bars logic
  const bars = 5;
  const getBarHeight = (index: number) => {
    if (!isConnected) return 10;
    // Simple visualizer effect based on volume
    // Randomize slightly to look active
    const baseHeight = 20;
    const variableHeight = Math.min(100, volume * 300 + Math.random() * 20);
    return baseHeight + variableHeight; 
  };

  return (
    <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-fade-in">
      <div className="relative w-full max-w-sm aspect-square bg-[#f0f0f0] rounded-full flex items-center justify-center shadow-inner mb-8">
        {/* Pulse Effect */}
        {isConnected && (
          <div className="absolute inset-0 rounded-full border-4 border-[#28a745]/20 animate-ping"></div>
        )}
        
        <div className="flex items-center gap-2 h-32">
           {[...Array(bars)].map((_, i) => (
             <div 
               key={i}
               className="w-3 bg-[#28a745] rounded-full transition-all duration-75 ease-linear"
               style={{ height: `${getBarHeight(i)}px` }}
             ></div>
           ))}
        </div>
      </div>

      <h2 className="text-xl font-bold text-[#333] mb-2">
        {error ? "حدث خطأ" : (isConnected ? "أستمع إليك..." : "جاري الاتصال...")}
      </h2>
      
      {error && <p className="text-red-500 mb-4">{error}</p>}

      <p className="text-[#666] text-sm mb-8 text-center">
        يمكنك التحدث بحرية. قاطعني في أي وقت.
      </p>

      <button
        onClick={onClose}
        className="bg-red-500 hover:bg-red-600 text-white rounded-full p-4 w-16 h-16 flex items-center justify-center shadow-lg transition-transform active:scale-95"
      >
        <i className="fas fa-times text-2xl"></i>
      </button>
    </div>
  );
};

export default VoiceInterface;