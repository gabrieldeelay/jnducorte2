import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getStyleSuggestion = async (
  faceShape: string,
  hairType: string,
  stylePreference: string
): Promise<string> => {
  try {
    const prompt = `
      Você é um especialista em visagismo e barbeiro profissional.
      Um cliente quer uma recomendação de corte.
      
      Características do cliente:
      - Formato do rosto: ${faceShape}
      - Tipo de cabelo: ${hairType}
      - Estilo preferido: ${stylePreference}
      
      Forneça uma recomendação curta, direta e moderna (máximo de 3 linhas) de um corte de cabelo e/ou barba que valorize o rosto dele.
      Fale diretamente com o cliente (use "você").
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    return response.text || "Não foi possível gerar uma sugestão no momento.";
  } catch (error) {
    console.error("Erro ao consultar Gemini:", error);
    return "Desculpe, nossa IA está descansando. Mas nossos barbeiros saberão te orientar na cadeira!";
  }
};