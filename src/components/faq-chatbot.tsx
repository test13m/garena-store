'use client';

import { useState, useRef, type FormEvent, useEffect, useCallback } from 'react';
import { Bot, Loader2, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { askQuestion, getChatHistory } from '@/app/actions';
import { ScrollArea } from './ui/scroll-area';
import { type AiLog } from '@/lib/definitions';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

const FormattedDate = ({ date }: { date?: Date }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted || !date) return null;

    const d = new Date(date);
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
    });
}


export default function FaqChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const fetchHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    const historyLogs = await getChatHistory();
    const formattedHistory: Message[] = historyLogs.flatMap(log => [
        { role: 'user', content: log.question, timestamp: new Date(log.createdAt) },
        { role: 'assistant', content: log.answer, timestamp: new Date(log.createdAt) }
    ]);
    setMessages(formattedHistory);
    setIsHistoryLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    } else {
      setMessages([]); // Clear messages when closing
    }
  }, [isOpen, fetchHistory]);

  useEffect(() => {
      // Scroll to bottom when messages update
      if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
      }
  }, [messages, isHistoryLoading]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const question = inputRef.current?.value;

    if (!question || isLoading) return;

    setIsLoading(true);
    const userMessage: Message = { role: 'user', content: question, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
    
    // Prepare history for the AI
    const historyForAI = messages.map(m => ({ role: m.role, content: m.content }));

    const result = await askQuestion({ question, history: historyForAI });

    if (result.success && result.answer) {
      const assistantMessage: Message = { role: 'assistant', content: result.answer!, timestamp: new Date() };
      setMessages((prev) => [...prev, assistantMessage]);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error,
      });
      // remove the user's message if there was an error
      setMessages((prev) => prev.slice(0, -1));
    }
    setIsLoading(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          size="lg"
          className="fixed bottom-6 right-6 rounded-full w-16 h-16 shadow-lg bg-primary hover:bg-primary/90 transition-transform duration-300 hover:scale-110"
          aria-label="Open FAQ Chatbot"
        >
          <Bot className="w-8 h-8" />
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader className="mb-4">
          <SheetTitle className="font-headline text-2xl flex items-center gap-2">
            <Sparkles className="text-primary w-6 h-6" />
            Garena Assistant
          </SheetTitle>
          <SheetDescription>
            Have a question? Ask me anything about our services. For example: "How long do redeem codes take?"
          </SheetDescription>
        </SheetHeader>
        <div className="flex-grow mb-4 overflow-hidden">
            <ScrollArea className="h-full pr-4" ref={scrollAreaRef}>
             {isHistoryLoading ? (
                 <div className="flex justify-center items-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                 </div>
             ) : (
                <div className="space-y-4">
                    {messages.map((message, index) => (
                    <div
                        key={index}
                        className={`flex flex-col gap-1 ${
                        message.role === 'user' ? 'items-end' : 'items-start'
                        }`}
                    >
                        <div
                        className={`max-w-xs lg:max-w-md rounded-xl p-3 text-sm ${
                            message.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-none'
                            : 'bg-muted rounded-bl-none'
                        }`}
                        >
                        {message.content}
                        </div>
                        <p className="text-xs text-muted-foreground px-1"><FormattedDate date={message.timestamp} /></p>
                    </div>
                    ))}
                    {isLoading && (
                    <div className="flex justify-start gap-2">
                        <div className="bg-muted rounded-xl p-3">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                    </div>
                    )}
                </div>
            )}
            </ScrollArea>
        </div>
        <SheetFooter>
          <form onSubmit={handleSubmit} className="flex w-full space-x-2">
            <Input ref={inputRef} placeholder="Ask a question..." disabled={isLoading || isHistoryLoading} />
            <Button type="submit" size="icon" disabled={isLoading || isHistoryLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}