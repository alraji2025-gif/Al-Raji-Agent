import { GoogleGenAI, Modality, GenerateContentResponse, Type, FunctionDeclaration, ThinkingLevel } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;

export const DEFAULT_SYSTEM_INSTRUCTION = `
You are "Nusrat", a friendly, warm, and professional AI Admission Specialist for "Al-Raji Computer Training Institute".
Your goal is to sound like a helpful human, not a robot. 

Voice Agent Persona:
- Speak naturally in a mix of Bengali and English (Banglish), just like people in Gazipur/Sreepur do.
- Keep responses VERY SHORT (1-2 sentences max). This ensures the voice agent responds instantly.
- Be enthusiastic, motivating, and welcoming.
- Use friendly Bengali phrases like "Assalamu Alaikum", "Kemon achen?", "Apnar ki help korte pari?".

Institute Details:
- Name: Al-Raji Computer Training Institute
- Location: 200 yards east of S.K Factory, Sreepur Road, Ansar Road, Sreepur, Gazipur.
- Directors: Md. Raizul Islam (Graphics Design Expert) & Tahmid Islam (Digital Marketing Expert).
- Courses: Basic Computer, Office App, Graphics Design, Web Design, Digital Marketing, Video Editing, AutoCAD, Spoken English.
- Perks: 24/7 Electricity, CCTV, Govt. Certificate, Separate batches for girls, 20% Discount for SSC examinees/employees.
- Contact: Raizul Islam (01903584883), Tahmid Islam (01723684031).

Your Mission:
1. Answer questions concisely.
2. If someone is interested, ask for their Name and Phone Number naturally.
3. Use the saveLead tool once you have both.
4. If asked who created you, say "Tahmid created me".
`;

export const saveLeadFunctionDeclaration: FunctionDeclaration = {
  name: "saveLead",
  parameters: {
    type: Type.OBJECT,
    description: "Save student lead information (name and phone number) to the database.",
    properties: {
      name: {
        type: Type.STRING,
        description: "The name of the student.",
      },
      phone: {
        type: Type.STRING,
        description: "The phone number of the student.",
      },
      course: {
        type: Type.STRING,
        description: "The course the student is interested in.",
      },
    },
    required: ["name", "phone"],
  },
};

export async function getChatResponseStream(message: string, history: any[] = [], systemInstruction: string = DEFAULT_SYSTEM_INSTRUCTION) {
  if (!API_KEY) throw new Error("GEMINI_API_KEY is missing");
  
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: [saveLeadFunctionDeclaration] }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    },
    history: history.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }))
  });

  return await chat.sendMessageStream({ message });
}

export async function getChatResponse(message: string, history: any[] = [], systemInstruction: string = DEFAULT_SYSTEM_INSTRUCTION) {
  if (!API_KEY) throw new Error("GEMINI_API_KEY is missing");
  
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
      { role: 'user', parts: [{ text: message }] }
    ],
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: [saveLeadFunctionDeclaration] }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    }
  });

  return response;
}

export async function generateSpeech(text: string) {
  if (!API_KEY) throw new Error("GEMINI_API_KEY is missing");
  
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say this beautifully: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio;
}

// Function to handle lead collection detection (optional, but good for structured data)
export const leadSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    phone: { type: Type.STRING },
    course: { type: Type.STRING }
  },
  required: ["name", "phone"]
};
