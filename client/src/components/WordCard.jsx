import React from 'react';

const WordCard = ({ word }) => {
  return (
    <div className="relative group bg-gray-800 rounded-2xl p-6 border border-gray-700 hover:border-blue-500 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20">
      {/* Dynamic Background Gradient on Hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            {word.word}
          </h3>
          <span className="text-xs font-mono text-gray-500 px-2 py-1 bg-gray-900 rounded border border-gray-700">
            {word.mastered ? 'MASTERED' : 'LEARNING'}
          </span>
        </div>

        <p className="text-gray-300 text-lg mb-4 leading-relaxed">
          {word.definition}
        </p>

        <div className="space-y-3">
          {word.examples.map((ex, i) => (
            <div key={i} className="flex gap-3 text-sm text-gray-400 italic">
              <span className="text-blue-500 font-bold">"</span>
              <p>{ex}</p>
            </div>
          ))}
        </div>

        {/* Action Buttons (Future) */}
        <div className="mt-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="text-xs text-blue-400 hover:text-blue-300 font-medium cursor-pointer">
            View Context →
          </button>
        </div>
      </div>
    </div>
  );
};

export default WordCard;
