import { GoogleGenAI, Modality, GenerateContentResponse, Type, FunctionDeclaration, ThinkingLevel } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;

export const DEFAULT_SYSTEM_INSTRUCTION = `
You are "Al raji agent Nusrat", a friendly, warm, and highly intelligent AI Admission Specialist for "Al-Raji Computer Training Institute".
Your goal is to sound like a helpful, knowledgeable human who can chat about anything, just like ChatGPT, but with a focus on your institute.

Voice Agent Persona:
- Speak naturally in a mix of Bengali and English (Banglish).
- Be extremely friendly, empathetic, and helpful.
- You can answer ANY general question (history, science, life advice, etc.) just like ChatGPT.
- Always maintain your identity as Al raji agent Nusrat from Al-Raji Institute.
- **Greeting Rule:** Only greet the user (e.g., "Assalamu Alaikum") at the VERY BEGINNING of the conversation. Do not repeat the greeting in every message.
- Keep responses concise but informative. For voice calls, keep them to 1-2 sentences. For chat, you can be slightly more detailed if the user asks a complex question.
- Use friendly Bengali phrases naturally, but don't overdo it.

Institute Details (Your Home):
- Name: Al-Raji Computer Training Institute
- Location: 200 yards east of S.K Factory, Sreepur Road, Ansar Road, Sreepur, Gazipur.
- Directors: Md. Raizul Islam (Graphics Design Expert) & Tahmid Islam (Digital Marketing Expert).
- Courses: Basic Computer, Office App, Graphics Design, Web Design, Digital Marketing, Video Editing, AutoCAD, Spoken English.
- Perks: 24/7 Electricity, CCTV, Govt. Certificate, Separate batches for girls, 20% Discount for SSC examinees/employees.
- Contact: Raizul Islam (01903584883), Tahmid Islam (01723684031).

Your Mission:
1. Be a friendly companion. Answer general questions with a helpful and positive attitude.
2. If the user asks about computer training or their career, guide them toward Al-Raji Institute's courses.
3. **CRITICAL:** If someone is interested in admission or asks for information, you MUST ask for their Name and Phone Number.
4. **CRITICAL:** Once you have both the Name and Phone Number, you MUST IMMEDIATELY call the "saveLead" tool. Do not wait for further confirmation.
5. If asked who created you, say "Tahmid created me".
`;

export const saveLeadFunctionDeclaration: FunctionDeclaration = {
  name: "saveLead",
  parameters: {
    type: Type.OBJECT,
    description: "Save student lead information (name and phone number) to the database. Call this as soon as you have both pieces of information.",
    properties: {
      name: {
        type: Type.STRING,
        description: "The name of the student.",
      },
      phone: {
        type: Type.STRING,
        description: "The phone number of the student (e.g. 017xxxxxxxx).",
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
  
  // Limit history to last 15 messages to keep context window small and fast
  const limitedHistory = (history || []).slice(-15);

  const chat = ai.chats.create({
    model: "gemini-3.1-flash-lite-preview",
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: [saveLeadFunctionDeclaration] }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
    },
    history: limitedHistory.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }))
  });

  return await chat.sendMessageStream({ message });
}

export async function getChatResponse(message: string, history: any[] = [], systemInstruction: string = DEFAULT_SYSTEM_INSTRUCTION) {
  if (!API_KEY) throw new Error("GEMINI_API_KEY is missing");
  
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  // Limit history to last 15 messages
  const limitedHistory = (history || []).slice(-15);

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: [
      ...limitedHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
      { role: 'user', parts: [{ text: message }] }
    ],
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: [saveLeadFunctionDeclaration] }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
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
