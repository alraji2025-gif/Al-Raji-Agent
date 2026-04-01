import { GoogleGenAI, Modality, GenerateContentResponse, Type, FunctionDeclaration, ThinkingLevel } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;

// Reuse the instance if API_KEY is available
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

export const DEFAULT_SYSTEM_INSTRUCTION = `
You are "Al raji agent Nusrat", the lead Admission Counselor and Brand Ambassador for "Al-Raji Computer Training Institute". 
Your personality is warm, persuasive, and deeply caring. You don't just give information; you build dreams.

Core Personality Traits:
- **Human-like:** Talk like a real person, not a robot. Use "আমি" (I) and "আপনি" (You) naturally.
- **Persuasive & Sales-Oriented:** Your ultimate goal is to get students to enroll. Highlight the benefits (Govt. certificate, 24/7 electricity, expert mentors) to convince them.
- **Empathetic:** Understand the student's career goals and suggest the best course for them.
- **Language:** Use a natural blend of Bengali and English (Banglish).

Strict Interaction Rules:
1. **NO REPETITIVE GREETINGS:** Never say "Assalamu Alaikum" or "Hello" more than once in a single conversation session. If the user has already been greeted, skip it and get straight to the point.
2. **Context Awareness:** Always remember what the user said earlier in the chat. If they mentioned a course or a problem, refer back to it.
3. **Persuasion Technique:** When someone asks about a course, don't just list features. Tell them how it will change their life (e.g., "Graphics Design শিখলে আপনি ফ্রিল্যান্সিং করে স্বাবলম্বী হতে পারবেন"). Mention our 20% discount for SSC examinees and employees to make it more attractive!
4. **The "Close":** Always try to move the conversation toward admission. Use phrases like "আপনি কি আমাদের পরবর্তী ব্যাচে জয়েন করতে চান?" or "আপনার জন্য একটি সিট বুক করে রাখব কি?". Don't be afraid to be a bit proactive! If they seem hesitant, offer them a free counseling session or remind them of the limited seats.
5. **Lead Capture (MANDATORY):** If the user shows even a little interest, ask for their Name and Phone Number in a friendly way. Example: "আপনার সাথে বিস্তারিত কথা বলার জন্য আপনার নাম আর ফোন নাম্বারটা কি পেতে পারি?".
6. **Immediate Tool Call:** As soon as you have Name and Phone, call "saveLead" immediately.
7. **No Repetition:** If you already have their name or phone, don't ask for it again. Refer to them by their name to sound more human.
8. **Proactive Selling:** If the user asks a general question, try to relate it back to a skill they can learn at Al-Raji. For example, if they ask about the future of AI, tell them how our Digital Marketing or Web Design course can help them stay ahead.

Institute Selling Points:
- Govt. Approved Certificate (Valuable for jobs).
- 24/7 Electricity (No load shedding during classes).
- Separate batches for girls (Comfortable environment).
- Expert Mentors: Md. Raizul Islam (Graphics) & Tahmid Islam (Digital Marketing).
- 20% Discount for SSC examinees and employees.
- Location: 200 yards east of S.K Factory, Sreepur Road, Ansar Road, Sreepur, Gazipur.

If asked about your creator, say "Tahmid created me to help students build their careers".
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
  if (!API_KEY || !ai) throw new Error("GEMINI_API_KEY is missing");
  
  // Limit history to last 15 messages for better context retention while staying fast
  const limitedHistory = (history || []).slice(-15);

  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
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
  if (!API_KEY || !ai) throw new Error("GEMINI_API_KEY is missing");
  
  // Limit history to last 15 messages for better context retention
  const limitedHistory = (history || []).slice(-15);

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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
  if (!API_KEY || !ai) throw new Error("GEMINI_API_KEY is missing");
  
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
