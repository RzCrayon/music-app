import { useCallback, useEffect, useState } from "react";
import './Toaster.css'

import { IoIosClose } from "react-icons/io";
import type { Toaster } from "../services/types";

export function useToaster(delete_delay?: number) {

    const [messages, setMessages] = useState<{ id: string, mssg: string, color: string }[]>([]);

    const add_message = useCallback((mssg: string, color: string = 'var(--err-colour)') => {
        const id = crypto.randomUUID();
        setMessages(prev => [...prev, { id, mssg, color }]);
        if (delete_delay !== undefined) {
            setTimeout(() => {
                setMessages(prev => prev.filter(message => message.id !== id));
            }, delete_delay);
        }
    }, []);

    const has_messages = useCallback(() => {
        return messages.length > 0;
    }, [])

    const remove_message = useCallback((id: string) => {
        setMessages(prev => prev.filter(message => message.id !== id));
    }, []);

    const clear_messages = useCallback(() => {
        setMessages([]);
    }, [])

    return { messages, add_message, remove_message, clear_messages, has_messages }

}

export function Toaster({ toaster }: { toaster: Toaster }) {

    const height = 70;
    const inter_toaster_gap = 20;

    return toaster.messages.map((message, idx) => (
        <div
            key={message.id}
            className="toaster"
            style={{
                bottom: `${inter_toaster_gap + idx * (height + inter_toaster_gap)}px`,
                height: `${height}px`,
                backgroundColor: message.color
            }}
        >
            <span className="text">
                {message.mssg}
            </span>
            <IoIosClose onClick={() => toaster.remove_message(message.id)} />
        </div>
    ))

}