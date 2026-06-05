import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Message = {
  id: number;
  sender: "bot" | "user";
  text: string;
};

type QuickQuestion = {
  id: number;
  label: string;
  question: string;
};

const quickQuestions: QuickQuestion[] = [
  {
    id: 1,
    label: "Missed Dose",
    question: "What should I do if I miss a dose?",
  },
  {
    id: 2,
    label: "After Food",
    question: "When should I take medicine after food?",
  },
  {
    id: 3,
    label: "Antibiotics",
    question: "Why should I complete antibiotics?",
  },
  {
    id: 4,
    label: "Side Effects",
    question: "What are common medication side effects?",
  },
  {
    id: 5,
    label: "Reminders",
    question: "How do medication reminders work in MEDCO?",
  },
  {
    id: 6,
    label: "Drug Safety",
    question: "How can I check if my medications are safe together?",
  },
  {
    id: 7,
    label: "How to use MEDCO",
    question: "How do I use the MEDCO app?",
  },
];

const initialMessages: Message[] = [
  {
    id: 1,
    sender: "bot",
    text: "Hello, I am MEDCO Assistant. I can answer general medication questions such as missed doses, timing, antibiotics, side effects, and reminders.",
  },
  {
    id: 2,
    sender: "bot",
    text: "Important: I provide general guidance only. I am not a doctor, and I cannot replace professional medical advice.",
  },
];

export default function ChatbotScreen() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const getBotReply = (question: string) => {
    const lowerQuestion = question.toLowerCase();

    if (
      lowerQuestion.includes("miss") ||
      lowerQuestion.includes("missed") ||
      lowerQuestion.includes("forgot")
    ) {
      return "If you miss a dose, take it when you remember unless it is almost time for your next dose. Do not take two doses at the same time unless your doctor or pharmacist tells you to.";
    }

    if (
      lowerQuestion.includes("food") ||
      lowerQuestion.includes("after eating") ||
      lowerQuestion.includes("before eating") ||
      lowerQuestion.includes("meal")
    ) {
      return "Some medicines should be taken after food to reduce stomach irritation, while others work better before food. Always follow the instruction on your prescription or ask your pharmacist.";
    }

    if (
      lowerQuestion.includes("antibiotic") ||
      lowerQuestion.includes("antibiotics") ||
      lowerQuestion.includes("complete") ||
      lowerQuestion.includes("finish")
    ) {
      return "It is important to complete antibiotics as prescribed, even if you feel better. Stopping early may allow bacteria to survive and become harder to treat.";
    }

    if (
      lowerQuestion.includes("side effect") ||
      lowerQuestion.includes("side effects") ||
      lowerQuestion.includes("dizzy") ||
      lowerQuestion.includes("nausea") ||
      lowerQuestion.includes("rash")
    ) {
      return "Common side effects may include nausea, dizziness, headache, sleepiness, or stomach discomfort. If you have severe symptoms such as breathing difficulty, swelling, or a serious rash, seek urgent medical help.";
    }

    if (
      lowerQuestion.includes("reminder") ||
      lowerQuestion.includes("notification") ||
      lowerQuestion.includes("alarm")
    ) {
      return "In MEDCO, medication reminders are connected to your prescription schedule. When a dose time arrives, you will receive a reminder. You can then mark the dose as Taken, Missed, or Snooze it for later.";
    }

    if (
      lowerQuestion.includes("scan") ||
      lowerQuestion.includes("prescription") ||
      lowerQuestion.includes("ocr")
    ) {
      return "The prescription scanning feature extracts medication names, dosages, and timing from prescription images using OCR technology. Always verify the extracted information before use.";
    }

    if (
      lowerQuestion.includes("safe") ||
      lowerQuestion.includes("safety") ||
      lowerQuestion.includes("interaction") ||
      lowerQuestion.includes("together")
    ) {
      return "Taking multiple medications together can sometimes cause interactions. MEDCO can flag potential conflicts based on your medication list. Always consult your doctor or pharmacist before combining medications.";
    }

    if (
      lowerQuestion.includes("allergy") ||
      lowerQuestion.includes("allergic")
    ) {
      return "If you have a known medication allergy, always inform your doctor and pharmacist. Symptoms of an allergic reaction may include rash, swelling, difficulty breathing, or dizziness. Seek emergency help immediately if this occurs.";
    }

    if (lowerQuestion.includes("how") && lowerQuestion.includes("medco")) {
      return "To use MEDCO: scan your prescription using the Scan tab, review your medication schedule in the Adherence tab, mark doses as Taken or Missed, and ask this chatbot for general medication guidance. Sign in to save your data to the cloud.";
    }

    if (
      lowerQuestion.includes("drug") ||
      lowerQuestion.includes("check") ||
      lowerQuestion.includes("combination")
    ) {
      return "To check drug safety, consult your pharmacist or doctor with your full medication list. MEDCO provides general guidance but does not replace a clinical drug interaction check by a healthcare professional.";
    }

    return "I can only help with general medication questions. Try asking about missed doses, taking medicine with food, antibiotics, side effects, reminders, prescription scanning, or medication safety. For other questions, please consult a healthcare professional.";
  };

  const sendMessage = (customQuestion?: string) => {
    const question = customQuestion || inputText.trim();

    if (!question) {
      return;
    }

    const userMessage: Message = {
      id: Date.now(),
      sender: "user",
      text: question,
    };

    const botMessage: Message = {
      id: Date.now() + 1,
      sender: "bot",
      text: getBotReply(question),
    };

    setMessages((previousMessages) => [
      ...previousMessages,
      userMessage,
      botMessage,
    ]);

    setInputText("");
  };

  const clearChat = () => {
    setMessages(initialMessages);
    setInputText("");
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <Text style={styles.title}>MEDCO Chatbot</Text>
        <Text style={styles.subtitle}>
          Ask general medication questions and get simple educational guidance.
        </Text>
      </View>

      <View style={styles.disclaimerBox}>
        <Text style={styles.disclaimerText}>
          ⚠️ This assistant gives general information only. For personal medical
          advice, contact a doctor or pharmacist.
        </Text>
      </View>

      <View style={styles.quickQuestionRow}>
        {quickQuestions.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.quickQuestionButton}
            onPress={() => sendMessage(item.question)}
          >
            <Text style={styles.quickQuestionText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.chatContainer}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.sender === "user" ? styles.userBubble : styles.botBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.sender === "user"
                  ? styles.userMessageText
                  : styles.botMessageText,
              ]}
            >
              {message.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask about medication..."
          placeholderTextColor="#94a3b8"
          value={inputText}
          onChangeText={setInputText}
          multiline
        />

        <TouchableOpacity
          style={styles.sendButton}
          onPress={() => sendMessage()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.clearButton} onPress={clearChat}>
        <Text style={styles.clearButtonText}>Clear Chat</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 18,
  },
  header: {
    marginTop: 10,
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 6,
    lineHeight: 22,
  },
  disclaimerBox: {
    backgroundColor: "#fef3c7",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  disclaimerText: {
    fontSize: 13,
    color: "#92400e",
    lineHeight: 19,
  },
  quickQuestionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  quickQuestionButton: {
    backgroundColor: "#dbeafe",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  quickQuestionText: {
    color: "#1d4ed8",
    fontWeight: "bold",
    fontSize: 12,
  },
  chatContainer: {
    flex: 1,
    marginBottom: 12,
  },
  messageBubble: {
    maxWidth: "85%",
    padding: 13,
    borderRadius: 16,
    marginBottom: 10,
  },
  botBubble: {
    backgroundColor: "#ffffff",
    alignSelf: "flex-start",
    borderTopLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: "#2563eb",
    alignSelf: "flex-end",
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  botMessageText: {
    color: "#0f172a",
  },
  userMessageText: {
    color: "#ffffff",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    fontSize: 15,
    color: "#0f172a",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  sendButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  sendButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  clearButton: {
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  clearButtonText: {
    color: "#64748b",
    fontWeight: "600",
  },
});
