import React, { useState } from 'react';
import { Sparkles, Loader2, User, UserCheck } from 'lucide-react';
import { getStyleSuggestion } from '../services/geminiService';

interface AiConsultantProps {
  onSkip: () => void;
  onApply: (suggestion: string) => void;
}

export const AiConsultant: React.FC<AiConsultantProps> = ({ onSkip, onApply }) => {
  const [faceShape, setFaceShape] = useState('');
  const [hairType, setHairType] = useState('');
  const [stylePreference, setStylePreference] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!faceShape || !hairType) return;
    
    setIsLoading(true);
    const result = await getStyleSuggestion(faceShape, hairType, stylePreference || "Moderno e prático");
    setSuggestion(result);
    setIsLoading(false);
  };

  if (suggestion) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 p-6 rounded-2xl mb-6">
          <div className="flex items-center gap-2 mb-4 text-indigo-300">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-semibold">Sugestão da IA</h3>
          </div>
          <p className="text-slate-200 leading-relaxed mb-6 italic">
            "{suggestion}"
          </p>
          <div className="flex gap-3">
            <button 
              onClick={() => onApply(suggestion)}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-colors"
            >
              Usar sugestão
            </button>
            <button 
              onClick={() => setSuggestion(null)}
              className="px-4 py-3 text-slate-400 hover:text-white transition-colors"
            >
              Tentar de novo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Consultoria de Estilo IA</h3>
            <p className="text-sm text-slate-400">Descubra o corte ideal para seu rosto</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Formato do Rosto</label>
            <select 
              value={faceShape}
              onChange={(e) => setFaceShape(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            >
              <option value="">Selecione...</option>
              <option value="Oval">Oval</option>
              <option value="Redondo">Redondo</option>
              <option value="Quadrado">Quadrado</option>
              <option value="Triangular">Triangular</option>
              <option value="Diamante">Diamante</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Cabelo</label>
            <select 
              value={hairType}
              onChange={(e) => setHairType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            >
              <option value="">Selecione...</option>
              <option value="Liso">Liso</option>
              <option value="Ondulado">Ondulado</option>
              <option value="Cacheado">Cacheado</option>
              <option value="Crespo">Crespo</option>
              <option value="Calvo/Pouco cabelo">Calvo / Pouco cabelo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Preferência (Opcional)</label>
            <input 
              type="text"
              value={stylePreference}
              onChange={(e) => setStylePreference(e.target.value)}
              placeholder="Ex: Curto, Discreto, Moderno..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={!faceShape || !hairType || isLoading}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 mt-4 transition-all ${
              !faceShape || !hairType 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'
            }`}
          >
            {isLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
            {isLoading ? 'Analisando...' : 'Gerar Recomendação'}
          </button>
        </div>
      </div>

      <button 
        onClick={onSkip}
        className="w-full text-slate-500 hover:text-slate-300 py-2 text-sm transition-colors"
      >
        Pular consultoria e agendar
      </button>
    </div>
  );
};
