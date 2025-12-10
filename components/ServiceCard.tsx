import React from 'react';
import { Check, Clock, Flame } from 'lucide-react';
import { Service } from '../types';

interface ServiceCardProps {
  service: Service;
  isSelected: boolean;
  onSelect: (service: Service) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, isSelected, onSelect }) => {
  return (
    <button
      onClick={() => onSelect(service)}
      className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 group ${
        isSelected
          ? 'bg-blue-900/20 border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.2)]'
          : 'bg-slate-800 border-slate-700 hover:border-slate-500 hover:bg-slate-750'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-col items-start">
          {service.isPopular && (
            <span className="inline-flex items-center gap-1 bg-orange-500/10 text-orange-500 text-[10px] font-bold px-2 py-0.5 rounded mb-1 uppercase tracking-wide border border-orange-500/20">
              <Flame size={10} /> Mais requisitado
            </span>
          )}
          <h3 className={`text-lg font-semibold ${isSelected ? 'text-red-500' : 'text-slate-100'}`}>
            {service.name}
          </h3>
        </div>
        {isSelected && <div className="bg-red-600 text-white rounded-full p-1"><Check size={14} /></div>}
      </div>
      
      <p className="text-slate-400 text-sm mb-4 leading-relaxed">
        {service.description}
      </p>
      
      <div className="flex justify-between items-center border-t border-slate-700/50 pt-3">
        <span className={`font-bold text-lg ${isSelected ? 'text-blue-400' : 'text-slate-200'}`}>
          R$ {service.price.toFixed(2).replace('.', ',')}
        </span>
        <div className="flex items-center text-slate-500 text-sm">
          <Clock size={14} className="mr-1" />
          {service.duration} min
        </div>
      </div>
    </button>
  );
};