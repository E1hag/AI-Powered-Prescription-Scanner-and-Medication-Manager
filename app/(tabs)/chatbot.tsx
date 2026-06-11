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
      return "In MEDCO, medication reminders are connected to the prescription schedule. When it is time for a dose, the user can mark it as Taken, Missed, or Snoozed.";
    }

    if (
      lowerQuestion.includes("scan") ||
      lowerQuestion.includes("prescription") ||
      lowerQuestion.includes("ocr")
    ) {
      return "The prescription scanning feature is designed to extract medication names, dosage, and timing from prescription images. The user should always review the extracted information before saving it.";
    }

    if (
      lowerQuestion.includes("safe") ||
      lowerQuestion.includes("safety") ||
      lowerQuestion.includes("interaction") ||
      lowerQuestion.includes("together") ||
      lowerQuestion.includes("drug")
    ) {
      return "Some medications may interact with each other. MEDCO can provide general safety guidance, but users should always confirm medication safety with a doctor or pharmacist.";
    }

    if (lowerQuestion.includes("how") && lowerQuestion.includes("medco")) {
      return "To use MEDCO, the user can scan a prescription, review the medication schedule, track doses as Taken or Missed, check adherence progress, and ask the chatbot general medication questions.";
    }

    return "I can only help with general medication questions. Try asking about missed doses, medicine after food, antibiotics, side effects, reminders, prescription scanning, or drug safety.";
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
          ⚠️ This assistant provides general medication guidance and is not a
          substitute for professional medical advice.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickScroll}
        contentContainerStyle={styles.quickContent}
      >
        {quickQuestions.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.quickQuestionButton}
            onPress={() => sendMessage(item.question)}
          >
            <Text style={styles.quickQuestionText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        ref={scrollViewRef}
        style={styles.chatContainer}
        showsVerticalScrollIndicator={false}
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
    paddingHorizontal: 18,
    paddingTop: 58,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
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
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  disclaimerText: {
    fontSize: 14,
    color: "#92400e",
    lineHeight: 20,
  },
  quickScroll: {
    maxHeight: 46,
    marginBottom: 14,
  },
  quickContent: {
    gap: 8,
    paddingRight: 10,
  },
  quickQuestionButton: {
    backgroundColor: "#dbeafe",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  quickQuestionText: {
    color: "#2563eb",
    fontWeight: "700",
    fontSize: 13,
  },
  chatContainer: {
    flex: 1,
    marginBottom: 12,
  },
  messageBubble: {
    maxWidth: "86%",
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 18,
    marginBottom: 10,
  },
  botBubble: {
    backgroundColor: "#ffffff",
    alignSelf: "flex-start",
    borderTopLeftRadius: 5,
  },
  userBubble: {
    backgroundColor: "#2563eb",
    alignSelf: "flex-end",
    borderTopRightRadius: 5,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
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
    borderRadius: 20,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 95,
    fontSize: 15,
    color: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 15,
  },
  sendButtonText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 15,
  },
  clearButton: {
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  clearButtonText: {
    color: "#64748b",
    fontWeight: "600",
    fontSize: 14,
  },
});
