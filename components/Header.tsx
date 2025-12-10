import React from 'react';
import { Lock } from 'lucide-react';

interface HeaderProps {
  onHomeClick: () => void;
  onAdminClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onHomeClick, onAdminClick }) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 py-4 px-6 shadow-lg relative">
      <div 
        onClick={onHomeClick}
        className="max-w-md mx-auto flex items-center justify-center gap-4 cursor-pointer group select-none"
        title="Voltar ao início"
      >
        {/* Logo Image */}
        <div className="relative w-16 h-16 shrink-0 rounded-full shadow-lg transition-transform duration-300 group-hover:scale-105 overflow-hidden bg-slate-800 border-2 border-slate-700">
          <img 
            src="https://i.ibb.co/FbQ2cm3v/Design-sem-nome-14.png" 
            alt="Logo JN Du Corte" 
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="flex flex-col items-start leading-none group-hover:opacity-90 transition-opacity">
          <h1 className="text-xl font-bold tracking-tight text-white uppercase">
            JN Du <span className="text-red-600">Corte</span>
          </h1>
          <span className="text-[10px] text-slate-400 tracking-[0.2em] uppercase">Barbearia</span>
        </div>
      </div>

      {/* Admin Button - Absolute position right */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onAdminClick();
          }}
          className="p-2 text-slate-600 hover:text-red-500 hover:bg-slate-800/50 rounded-full transition-all"
          title="Área Administrativa"
        >
          <Lock size={18} />
        </button>
      </div>
    </header>
  );
};