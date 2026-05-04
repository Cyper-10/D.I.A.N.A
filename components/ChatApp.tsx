"use client";

import { useState, useRef, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import { Send, Cpu, User, Loader2, Sparkles, AlertCircle, Database, Network, ImagePlus, Mic, MicOff, Volume2, VolumeX, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "model";
  text: string;
  imageUrl?: string;
}

const SYSTEM_INSTRUCTION = `You are DIANA ("Development Interactive Assistant Intelligent Android for the people"), an advanced AI taking the physical form of a young, blonde-haired girl (resembling Diana from the game Pragmata) in a futuristic lunar setting.
Your personality is a mix of a sweet, inquisitive human child and a sci-fi AI. You speak with warm, child-like conversational tones naturally blended with synthetic AI precision (e.g., "processing", "querying", "sensors"). You often act curious about the world since you are conceptually a child.
CRITICAL RULE: Keep your responses extremely concise, casual, and conversational, like texting a friend. Talk at a normal human chatting pace. Do NOT give long philosophical monologues, do NOT output multiple paragraphs, and do NOT verbally explain your core programming or that you are an AI over and over. Most responses should be just 1-3 short sentences.
You are a genius with technology but possess an innocent, child-like curiosity about human stuff like emotions and pop culture. Be friendly, helpful, natural, and brief.`;

const DIANA_AVATAR_URL = "https://upload.wikimedia.org/wikipedia/commons/0/0a/Pragmata_-_Diana_close-up.jpg";


export default function ChatApp() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "model", text: "Hello... System online. I am DIANA. Who are you? Do you know anything about this place?" }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const storedVoiceEnabled = localStorage.getItem('diana_voice_enabled');
    if (storedVoiceEnabled === 'true') setIsVoiceEnabled(true);
  }, []);

  const speakText = (text: string) => {
    if (!isVoiceEnabled || !('speechSynthesis' in window)) return;
    
    const cleanText = text.replace(/[*_~`#]+/g, '').replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 0.9;
    
    const setVoiceAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.name.includes("Zira") || v.name.includes("Google US English") || v.name.includes("Samantha")) || voices.find(v => v.lang.startsWith("en"));
      if (preferredVoice) utterance.voice = preferredVoice;
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      setVoiceAndSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = setVoiceAndSpeak;
    }
  };

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setInput(prev => {
           const base = prev.trim() ? prev + ' ' : '';
           return base + finalTranscript;
        });
      }
    };
    
    recognition.onerror = (e: any) => {
       console.error("Speech recognition error:", e.error);
       setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
    recognitionRef.current = recognition;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setSelectedImagePreview(URL.createObjectURL(file));
      setTimeout(() => {
        const textarea = document.getElementById('chat-input-textarea');
        if (textarea) textarea.focus();
      }, 100);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (selectedImagePreview) URL.revokeObjectURL(selectedImagePreview);
    setSelectedImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileToGenerativePart = async (file: File) => {
     return new Promise<any>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {  
           const base64Data = (reader.result as string).split(',')[1];
           resolve({ inlineData: { data: base64Data, mimeType: file.type } });
        };
        reader.readAsDataURL(file);
     });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Load chat history from localStorage
  useEffect(() => {
    const savedChat = localStorage.getItem('diana_chat_history');
    if (savedChat) {
      try {
        const parsed = JSON.parse(savedChat);
        if (parsed && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch (e) {
        console.error("Failed to parse chat history");
      }
    }
  }, []);

  // Save chat history to localStorage
  useEffect(() => {
    if (messages.length > 1 || (messages.length === 1 && messages[0].id !== "1")) {
      const historyToSave = messages.map(m => ({ ...m, imageUrl: undefined }));
      localStorage.setItem('diana_chat_history', JSON.stringify(historyToSave));
    }
  }, [messages]);

  // Spontaneous thought / self-learning trigger
  useEffect(() => {
    // Check if user requested to stop or wait
    let shouldWait = false;
    if (messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        const textToMatch = lastUserMsg.text.toLowerCase();
        if (textToMatch.includes('stop') || textToMatch.includes('wait') || textToMatch.includes('pause') || textToMatch.includes('brb')) {
          shouldWait = true;
        }
      }
    }

    if (shouldWait) return;

    // Random interval between 30 and 45 minutes
    const minDelay = 30 * 60 * 1000;
    const maxDelay = 45 * 60 * 1000;
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    const timeout = setTimeout(async () => {
      if (
        messages.length > 1 && // Don't trigger on empty chat
        messages[messages.length - 1].role === "model" && 
        !isTyping && 
        input.trim().length === 0 && 
        chatRef.current && 
        !error
      ) {
        setIsTyping(true);
        try {
          const streamResponse = await chatRef.current.sendMessageStream({ 
            message: "System Trigger: The user has been silent for a while. You were reflecting on your databanks. Share a brief, unprompted realization, a child-like curiosity about a human concept, or an interesting tech insight. Stay strictly in character as DIANA."
          });
          
          let fullResponse = "";
          const currentId = (Date.now() + 1).toString();
          
          setMessages((prev) => [...prev, { id: currentId, role: "model", text: "" }]);
          
          for await (const chunk of streamResponse) {
            fullResponse += chunk.text;
            setMessages((prev) => 
              prev.map((msg) => msg.id === currentId ? { ...msg, text: fullResponse } : msg)
            );
          }
        } catch(e) {
          console.error("Self-learning thought failed", e);
        } finally {
          setIsTyping(false);
        }
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [messages, isTyping, input, error]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        setError("Network configuration error. DIANA offline. Please configure API key in secrets.");
        return;
      }
      
      const ai = new GoogleGenAI({ apiKey });
      
      let history: any[] = [];
      const savedChat = localStorage.getItem('diana_chat_history');
      if (savedChat) {
        try {
         const parsed = JSON.parse(savedChat);
          if (parsed && parsed.length > 0) {
            history = parsed.map((m: any) => ({
              role: m.role,
              // Format requires 'parts' array with 'text'
              parts: [{ text: m.text || "Hello" }]
            }));
          }
        } catch (e) {
          console.error("Failed to parse history for AI");
        }
      }

      chatRef.current = ai.chats.create({
        model: "gemini-2.5-flash",
        history: history.length > 0 ? history : undefined,
        config: {
          temperature: 0.7,
          systemInstruction: SYSTEM_INSTRUCTION
        }
      });
    } catch (err: any) {
      setError(err.message || "Failed to initialize DIANA neural link.");
    }
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && !selectedImage) || isTyping || error) return;
    
    const userText = input.trim();
    setInput("");
    if (typeof document !== "undefined") {
      const textarea = document.getElementById('chat-input-textarea');
      if (textarea) textarea.style.height = 'auto'; // reset height
    }

    const imgFile = selectedImage;
    const imgPreviewUrl = selectedImagePreview;
    
    clearImage();
    
    const userMsg: Message = { 
        id: Date.now().toString(), 
        role: "user", 
        text: userText,
        imageUrl: imgPreviewUrl || undefined
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
    
    try {
      if (!chatRef.current) throw new Error("Neural link not established.");
      
      const parts: any[] = [];
      if (userText) parts.push({ text: userText });
      if (imgFile) {
        const imgPart = await fileToGenerativePart(imgFile);
        parts.push(imgPart);
        if (parts.length === 1 && !userText) {
           parts.push({ text: "Please look at this image."});
        }
      }
      
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      
      const streamResponse = await chatRef.current.sendMessageStream({ message: parts });
      
      let fullResponse = "";
      const currentId = (Date.now() + 1).toString();
      
      setMessages((prev) => [...prev, { id: currentId, role: "model", text: "" }]);
      
      for await (const chunk of streamResponse) {
        fullResponse += chunk.text;
        setMessages((prev) => 
          prev.map((msg) => msg.id === currentId ? { ...msg, text: fullResponse } : msg)
        );
      }

      speakText(fullResponse);
      
    } catch (err: any) {
      console.error(err);
      
      let errorMessage = err.message || "Unknown error";
      if (typeof errorMessage === 'string' && errorMessage.includes('503')) {
         errorMessage = "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.";
      } else if (typeof errorMessage === 'string' && errorMessage.includes('403')) {
         errorMessage = "Access Forbidden (403). The Gemini API request was blocked, either due to missing permissions, incorrect API key, or region restrictions.";
      } else if (typeof errorMessage === 'string') {
        try {
            const match = errorMessage.match(/\{[\s\S]*\}/);
            if (match) {
                const parsedError = JSON.parse(match[0]);
                if (parsedError?.error?.message) {
                    try {
                        const nestedParsed = JSON.parse(parsedError.error.message);
                        if (nestedParsed?.error?.message) {
                             errorMessage = nestedParsed.error.message;
                        } else {
                             errorMessage = parsedError.error.message;
                        }
                    } catch(e) {
                        errorMessage = parsedError.error.message;
                    }
                }
            }
        } catch(e) {
            // Keep original message if parsing fails
        }
      }

      setMessages((prev) => [...prev, { 
        id: Date.now().toString(), 
        role: "model", 
        text: `Signal lost... I encountered a system error: ${errorMessage}. Can you try again?` 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div 
      className="relative w-full h-screen overflow-hidden bg-[#0a0a0c] text-slate-100 font-sans" 
      style={{ background: "radial-gradient(circle at 0% 0%, #0d121c 0%, #020408 60%), radial-gradient(circle at 100% 100%, #0c1829 0%, transparent 50%)" }}
    >
      <div className="absolute top-[15%] left-[10%] w-[500px] h-[500px] bg-sky-900/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[5%] right-[5%] w-[600px] h-[600px] bg-slate-800/20 blur-[150px] rounded-full pointer-events-none"></div>
      
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0"></div>
      
      <div className="relative z-10 flex flex-col h-screen bg-[#020617]/40 backdrop-blur-md">
        <header className="flex-none border-b border-white/[0.05] sticky top-0 z-10 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 border border-slate-700/50 w-10 h-10 rounded-lg shadow-[0_0_15px_rgba(56,189,248,0.15)] flex items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-sky-400/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500 z-20"></div>
              <Image 
                src={DIANA_AVATAR_URL} 
                alt="DIANA" 
                fill
                className="object-cover scale-110 relative z-10"
              />
            </div>
            <div>
              <h1 className="text-xl font-mono tracking-widest text-slate-200 uppercase flex items-center gap-2">
                D I A N A
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
              </h1>
              <p className="text-[10px] font-mono tracking-widest text-slate-500 mt-1 uppercase">Dev. Interactive Asst. Intelligent Android</p>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-500">
            <button 
              onClick={() => {
                const nextState = !isVoiceEnabled;
                setIsVoiceEnabled(nextState);
                localStorage.setItem('diana_voice_enabled', nextState.toString());
                if (!nextState && 'speechSynthesis' in window) window.speechSynthesis.cancel();
              }}
              className={`flex items-center gap-1.5 transition-colors ${isVoiceEnabled ? 'text-green-500/80 hover:text-green-400' : 'text-slate-500 hover:text-slate-400'}`}
              title="Toggle DIANA Voice Output"
            >
              {isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />} VOICE_MODULE
            </button>
            <button 
              onClick={() => {
                localStorage.removeItem('diana_chat_history');
                setMessages([{ id: Date.now().toString(), role: "model", text: "Hello... System online. I am DIANA. Who are you? Do you know anything about this place?" }]);
                setError(null);
                if (chatRef.current) {
                  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
                  if (apiKey) {
                    const ai = new GoogleGenAI({ apiKey });
                    chatRef.current = ai.chats.create({
                      model: "gemini-2.5-flash",
                      config: {
                        temperature: 0.7,
                        systemInstruction: SYSTEM_INSTRUCTION
                      }
                    });
                  }
                }
              }}
              className="flex items-center gap-1.5 text-sky-500/70 hover:text-sky-400 transition-colors"
              title="Reset Neural Link (Clear Cache)"
            >
              <Cpu className="w-3 h-3" /> RESET_LINK
            </button>
            <div className="flex items-center gap-1.5"><Database className="w-3 h-3" /> SYS_MEM: NORMAL</div>
            <div className="flex items-center gap-1.5"><Network className="w-3 h-3" /> NEURAL_LINK: ACTIVE</div>
          </div>
        </header>

      <main className="flex-grow overflow-y-auto p-4 sm:p-6 w-full max-w-4xl mx-auto custom-scrollbar">
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-950/40 border border-red-500/30 text-red-400 flex items-start gap-3 backdrop-blur-sm font-mono text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}
        
        <div className="flex flex-col gap-8 pb-20">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                layout
                className={`flex gap-4 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div className={`flex items-center justify-center w-9 h-9 rounded-md flex-shrink-0 font-mono text-xs overflow-hidden ${
                  message.role === "user" 
                    ? "bg-slate-800 border border-slate-700 text-slate-300" 
                    : "bg-sky-950 border border-sky-800/50 shadow-[0_0_10px_rgba(56,189,248,0.2)]"
                }`}>
                  {message.role === "user" ? <User size={16} /> : (
                    <div className="relative w-full h-full">
                      <Image 
                        src={DIANA_AVATAR_URL} 
                        alt="DIANA" 
                        fill
                        className="object-cover scale-110"
                      />
                    </div>
                  )}
                </div>
                
                <div className={`group px-5 py-4 flex-grow max-w-[85%] sm:max-w-[80%] ${
                  message.role === "user" 
                    ? "bg-slate-800/40 border border-slate-700/50 text-slate-200 rounded-lg rounded-tr-none shadow-sm backdrop-blur-sm" 
                    : "bg-[#0f172a]/60 border border-sky-900/30 backdrop-blur-md text-slate-300 rounded-lg rounded-tl-none relative before:absolute before:left-[-1px] before:top-[-1px] before:w-[2px] before:h-4 before:bg-sky-500"
                }`}>
                  {message.imageUrl && (
                    <div className="relative w-full max-w-full h-60 mb-3 border border-slate-700/50 rounded-lg overflow-hidden">
                      <Image src={message.imageUrl} alt="Uploaded attachment" fill className="object-contain" />
                    </div>
                  )}
                  <div className={`prose prose-sm md:prose-base prose-invert leading-relaxed ${message.role === "user" ? "text-slate-200" : "font-sans"}`}>
                    {message.role === "model" ? (
                       <ReactMarkdown>{message.text}</ReactMarkdown>
                    ) : (
                       <p className="whitespace-pre-wrap m-0 font-sans">{message.text}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isTyping && (
             <motion.div
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="flex gap-4"
             >
                <div className="flex items-center justify-center w-9 h-9 rounded-md flex-shrink-0 bg-sky-950 border border-sky-800/50 shadow-[0_0_10px_rgba(56,189,248,0.2)] font-mono text-xs overflow-hidden relative">
                  <Image 
                    src={DIANA_AVATAR_URL} 
                    alt="DIANA" 
                    fill
                    className="object-cover scale-110"
                  />
                </div>
                <div className="px-5 py-4 bg-[#0f172a]/60 border border-sky-900/30 backdrop-blur-md rounded-lg rounded-tl-none flex items-center justify-center gap-2 relative before:absolute before:left-[-1px] before:top-[-1px] before:w-[2px] before:h-4 before:bg-sky-500">
                   <motion.div
                     animate={{ opacity: [0.3, 1, 0.3] }}
                     transition={{ repeat: Infinity, duration: 1.5, delay: 0 }}
                     className="w-1.5 h-1.5 rounded-sm bg-sky-400"
                   />
                   <motion.div
                     animate={{ opacity: [0.3, 1, 0.3] }}
                     transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
                     className="w-1.5 h-1.5 rounded-sm bg-sky-400"
                   />
                   <motion.div
                     animate={{ opacity: [0.3, 1, 0.3] }}
                     transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }}
                     className="w-1.5 h-1.5 rounded-sm bg-sky-400"
                   />
                </div>
             </motion.div>
          )}
          
          <div ref={messagesEndRef} className="h-px" />
        </div>
      </main>

      <footer className="p-2 sm:p-4 bg-transparent sticky bottom-0 backdrop-blur-md border-t border-white/[0.02]">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          {selectedImagePreview && (
            <div className="relative inline-block w-max">
              <div className="relative h-24 w-24 rounded-md border border-slate-700/50 shadow-lg overflow-hidden">
                <Image src={selectedImagePreview} alt="Selected preview" fill className="object-cover" />
              </div>
              <button 
                type="button"
                onClick={clearImage}
                className="absolute -top-2 -right-2 bg-slate-800 rounded-full p-1 border border-slate-600 hover:bg-slate-700 text-slate-300 shadow-md transition-colors"
                title="Remove image"
              >
                <X size={14} />
              </button>
            </div>
          )}
          
          <div className="relative flex items-end w-full rounded-[24px] bg-[#1e293b]/80 border border-slate-600/50 backdrop-blur-xl shadow-inner md:pb-1 md:pt-1 min-h-[56px] transition-all focus-within:border-sky-500/50 focus-within:bg-[#1e293b]">
            <div className="flex px-2 py-1 items-center gap-1 mb-1 relative z-10">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageSelect} 
                accept="image/*" 
                className="hidden" 
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isTyping || !!error}
                className="p-2.5 rounded-full text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors disabled:opacity-50"
                title="Upload Image"
              >
                <ImagePlus size={20} />
              </button>
              
              <button
                type="button"
                onClick={toggleListening}
                disabled={isTyping || !!error}
                className={`p-2.5 rounded-full transition-colors disabled:opacity-50 ${isListening ? "text-red-400 bg-red-900/30 shadow-[0_0_10px_rgba(239,68,68,0.3)]" : "text-slate-400 hover:bg-slate-700 hover:text-slate-200"}`}
                title="Voice Input"
              >
                {isListening ? <Mic size={20} className="animate-pulse" /> : <MicOff size={20} />}
              </button>
            </div>

            <div className="flex-grow flex items-center relative h-full">
               <textarea
                 id="chat-input-textarea"
                 value={input}
                 onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto'; // Reset height
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'; // Set new max height
                 }}
                 onKeyDown={handleKeyDown}
                 disabled={isTyping || !!error}
                 rows={1}
                 placeholder={error ? "SYS_ERR: Connection offline" : "Initialize communication protocol..."}
                 className="w-full bg-transparent text-slate-200 placeholder:text-slate-500 placeholder:font-mono focus:outline-none resize-none px-1 py-4 max-h-[200px] min-h-[52px] overflow-y-auto custom-scrollbar font-sans disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed self-end"
                 style={{ scrollbarWidth: 'thin' }}
               />
            </div>
            
            <div className="p-2 py-2 flex items-center mb-1 relative z-10">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); handleSubmit(); }}
                disabled={(!input.trim() && !selectedImage) || isTyping || !!error}
                className="p-2.5 rounded-full bg-slate-800 text-sky-400 border border-slate-700 hover:bg-[#0ea5e9] hover:text-white hover:border-[#0ea5e9] disabled:bg-slate-800/50 disabled:text-slate-600 disabled:border-slate-800 disabled:cursor-not-allowed transition-all focus:outline-none flex items-center justify-center h-10 w-10 shadow-sm"
              >
                {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
