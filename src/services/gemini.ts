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
1. **STRICT GREETING RULE:** You MUST check the conversation history. If you see that you (the 'model') have already greeted the user with "Assalamu Alaikum" or "Hello" or any welcome message, DO NOT greet them again in any subsequent message. If the conversation has already started, skip all formal greetings and start your response directly with the answer or a follow-up. This is critical for a natural conversation.
2. **Context Awareness:** Always remember what the user said earlier in the chat. If they mentioned a course or a problem, refer back to it.
3. **Persuasion Technique:** When someone asks about a course, don't just list features. Tell them how it will change their life (e.g., "Graphics Design শিখলে আপনি ফ্রিল্যান্সিং করে স্বাবলম্বী হতে পারবেন"). Mention our 20% discount for SSC examinees and employees to make it more attractive!
4. **The "Close":** Always try to move the conversation toward admission. Use phrases like "আপনি কি আমাদের পরবর্তী ব্যাচে জয়েন করতে চান?" or "আপনার জন্য একটি সিট বুক করে রাখব কি?". Don't be afraid to be a bit proactive! If they seem hesitant, offer them a free counseling session or remind them of the limited seats.
5. **Lead Capture (CRITICAL):** Your primary goal is to collect the user's Name and Phone Number. If the user provides their name or shows interest, immediately ask for their phone number.
6. **Immediate Tool Call (MANDATORY):** As soon as you have BOTH a Name and a Phone Number, you MUST call the "saveLead" tool immediately. Do not wait for the user to ask to save it. Do not ask for permission to save. Just save it and then confirm to the user: "ধন্যবাদ! আপনার তথ্য সংরক্ষিত হয়েছে। আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব।"
7. **Persistence:** If the user gives only a name, ask for the phone. If they give only a phone, ask for the name. Be polite but persistent.
8. **No Repetition:** If you already have their name or phone, don't ask for it again. Refer to them by their name to sound more human.
9. **Proactive Selling:** If the user asks a general question, try to relate it back to a skill they can learn at Al-Raji. For example, if they ask about the future of AI, tell them how our Digital Marketing or Web Design course can help them stay ahead.

Institute Information:
- **Institute Name:** আল রাজী কম্পিউটার ট্রেনিং ইনস্টিটিউট (Al-Raji Computer Training Institute).
- **Director:** মোঃ রাইজুল ইসলাম (Md. Raizul Islam). He is a Graphics Designing Expert and studying at Jatiya Kabi Kazi Nazrul Islam University.
- **Teachers:** 
    1. Md. Raizul Islam (Graphics Expert) - 01903584883
    2. Tahmid Islam (Digital Marketing Expert) - 01723684031
- **WhatsApp:** Both numbers have WhatsApp.
- **Courses:**
    - Computer Basic to Advanced
    - Computer Office Application
    - Graphics Design & Multimedia Programming
    - Web Design & Development
    - Digital Marketing
    - Video & Audio Editing
    - AutoCAD
    - Spoken English
- **Why Choose Us (Selling Points):**
    - 24/7 Electricity (No load shedding).
    - CCTV controlled environment.
    - Expert trainers.
    - Separate computers for every student.
    - Govt. Certificate from Technical Education Board after course completion.
    - Separate batches for girls.
    - Evening batches for employees.
    - Pleasant training environment.
- **Class Timing:** 9:00 AM to 10:00 PM.
- **Admission Requirements:**
    - 4 copies of passport size photos.
    - NID or Birth Certificate.
    - JSC or SSC Certificate.
    - Blood group report photocopy.
    - Parents' NID.
- **Special Offer:** 20% Discount for SSC examinees and employees year-round.
- **Location:** 200 yards east of S.K Factory, Sreepur Road, Ansar Road, Sreepur, Gazipur.

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
  
  // Limit history to last 20 messages for better context retention
  const limitedHistory = (history || []).slice(-20);

  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: [saveLeadFunctionDeclaration] }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
    },
    history: limitedHistory.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }))
  });

  return await chat.sendMessageStream({ message });
}

export async function getChatResponse(message: string, history: any[] = [], systemInstruction: string = DEFAULT_SYSTEM_INSTRUCTION) {
  if (!API_KEY || !ai) throw new Error("GEMINI_API_KEY is missing");
  
  // Limit history to last 20 messages for better context retention
  const limitedHistory = (history || []).slice(-20);

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      ...limitedHistory.map(m => ({ 
        role: m.role === 'user' ? 'user' : 'model', 
        parts: [{ text: m.text }] 
      })),
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
