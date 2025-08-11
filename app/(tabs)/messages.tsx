import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ltdxlajzilbvmipcuqxd.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0ZHhsYWp6aWxidm1pcGN1cXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NTQxMDEsImV4cCI6MjA3MDMzMDEwMX0.si0smbCAHPa7w9qbhzErQpo8rWJ7_vyZWPYXyJrHzBE";
const supabase = createClient(supabaseUrl, supabaseKey);

type Message = {
  id: number;
  chatroom_id: string;
  sender_id: string;
  message_text: string;
  created_at: string;
};

export default function ChatRoom() {
  const registeredRouteId = "11111111-1111-1111-1111-111111111111"; // Your test route UUID
  const passengerId = "44444444-4444-4444-4444-444444444444"; // New user UUID

  const [chatroomId, setChatroomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>("");
  const [members, setMembers] = useState<string[]>([]); // user IDs
  const [memberNames, setMemberNames] = useState<string[]>([]); // user display names
  const [usernames, setUsernames] = useState<Record<string, string>>({});

  const [routeName, setRouteName] = useState<string>("Loading route...");
  const [showMembers, setShowMembers] = useState<boolean>(false);

  useEffect(() => {
    async function fetchRouteName() {
      const { data, error } = await supabase
        .from("routes")
        .select("route_name")
        .eq("id", registeredRouteId)
        .single();

      if (error) {
        console.error("Error fetching route name:", error);
        setRouteName("Unknown route");
      } else if (data) {
        setRouteName(data.route_name || "Unnamed route");
      }
    }
    fetchRouteName();
  }, [registeredRouteId]);

  useEffect(() => {
    if (!registeredRouteId) {
      console.warn("registeredRouteId is missing or undefined");
      return;
    }
    async function fetchChatroom() {
      const { data, error } = await supabase
        .from("chatrooms")
        .select("id")
        .eq("route_id", registeredRouteId)
        .single();
      if (error) {
        console.error("Error fetching chatroom:", error);
        return;
      }
      if (data) setChatroomId(data.id);
    }
    fetchChatroom();
  }, [registeredRouteId]);

  useEffect(() => {
    if (!chatroomId) return;

    async function fetchMessages() {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chatroom_id", chatroomId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }
      if (data) {
        setMessages(data);

        const uniqueSenderIds = Array.from(
          new Set(data.map((m) => m.sender_id))
        );

        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, name")
          .in("id", uniqueSenderIds);

        if (usersError) {
          console.error("Error fetching usernames:", usersError);
          return;
        }

        if (usersData) {
          const usernamesMap: Record<string, string> = {};
          usersData.forEach((user) => {
            usernamesMap[user.id] = user.name || "Unknown";
          });
          setUsernames(usernamesMap);
        }
      }
    }
    fetchMessages();

    const subscription = supabase
      .channel(`chatroom-${chatroomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chatroom_id=eq.${chatroomId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);

          if (!usernames[newMsg.sender_id]) {
            const { data: userData, error: userError } = await supabase
              .from("users")
              .select("id, name")
              .eq("id", newMsg.sender_id)
              .single();

            if (userError) {
              console.error(
                "Error fetching username for new message:",
                userError
              );
              return;
            }

            if (userData) {
              setUsernames((prev) => ({
                ...prev,
                [userData.id]: userData.name || "Unknown",
              }));
            }
          }
        }
      )
      .subscribe();

    async function updatePresence() {
      if (!chatroomId) return;
      await supabase.from("chatroom_members").upsert({
        chatroom_id: chatroomId,
        user_id: passengerId,
        last_active_at: new Date().toISOString(),
      });
    }
    updatePresence();
    const presenceInterval = setInterval(updatePresence, 30000);

    async function fetchMembers() {
      if (!chatroomId) return;

      const { data, error } = await supabase
        .from("chatroom_members")
        .select("user_id")
        .eq("chatroom_id", chatroomId);

      if (error) {
        console.error("Error fetching members:", error);
        return;
      }
      if (data) {
        const userIds = data.map((m: any) => m.user_id);
        setMembers(userIds);

        // Fetch user names for these IDs
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, name")
          .in("id", userIds);

        if (usersError) {
          console.error("Error fetching member names:", usersError);
          setMemberNames(userIds); // fallback to ids if error
          return;
        }

        if (usersData) {
          const names = usersData.map((user) => user.name || "Unknown");
          setMemberNames(names);
        } else {
          setMemberNames(userIds); // fallback if no data
        }
      }
    }
    fetchMembers();

    const membersInterval = setInterval(fetchMembers, 30000);

    return () => {
      supabase.removeChannel(subscription);
      clearInterval(presenceInterval);
      clearInterval(membersInterval);
    };
  }, [chatroomId, usernames]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatroomId) return;

    const { error } = await supabase.from("messages").insert([
      {
        chatroom_id: chatroomId,
        sender_id: passengerId,
        message_text: newMessage.trim(),
      },
    ]);
    if (error) {
      console.error("Error sending message:", error);
    } else {
      setNewMessage("");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.header}
          onPress={() => setShowMembers(!showMembers)}
          activeOpacity={0.7}
        >
          <Text style={styles.headerText}>{routeName}</Text>
        </TouchableOpacity>

        {showMembers && (
          <View style={styles.sidePanel}>
            {/* Route name at top */}
            <Text style={styles.routeName}>{routeName}</Text>
            {/* Members header */}
            <Text style={styles.sidePanelHeader}>Members</Text>
            {/* List of members */}
            <FlatList
              data={memberNames}
              keyExtractor={(item, index) => item + index}
              renderItem={({ item }) => (
                <View style={styles.memberItem}>
                  <Text style={styles.memberName}>{item}</Text>
                </View>
              )}
            />
          </View>
        )}

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          style={styles.messageList}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View
              style={[
                styles.messageBubble,
                item.sender_id === passengerId
                  ? styles.myMessage
                  : styles.otherMessage,
              ]}
            >
              <Text style={styles.messageSender}>
                {usernames[item.sender_id] || item.sender_id}
              </Text>
              <Text style={styles.messageText}>{item.message_text}</Text>
            </View>
          )}
        />

        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Type a message"
            value={newMessage}
            onChangeText={setNewMessage}
            style={styles.input}
            multiline
            placeholderTextColor="#888"
          />
          <Button title="Send" onPress={sendMessage} color="#1DB954" />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const screenWidth = Dimensions.get("window").width;

const styles = StyleSheet.create({
  keyboardAvoiding: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#121212", // Dark Spotify background
    padding: 10,
  },
  header: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1DB954",
    marginBottom: 8,
  },
  headerText: {
    color: "#1DB954",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  sidePanel: {
    position: "absolute",
    top: 50,
    left: 0,
    width: screenWidth * 0.7,
    height: "90%",
    backgroundColor: "#121212",
    borderRightWidth: 1,
    borderRightColor: "#1DB954",
    zIndex: 1000,
  },
  routeName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1DB954",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1DB954",
  },
  sidePanelHeader: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1DB954",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1DB954",
    backgroundColor: "#121212",
  },
  memberItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomColor: "#282828",
    borderBottomWidth: 1,
  },
  memberName: {
    color: "#fff",
    fontSize: 16,
  },
  messageList: {
    flex: 1,
  },
  messageBubble: {
    maxWidth: screenWidth * 0.75,
    borderRadius: 15,
    marginVertical: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  myMessage: {
    backgroundColor: "#1DB954",
    alignSelf: "flex-end",
  },
  otherMessage: {
    backgroundColor: "#282828",
    alignSelf: "flex-start",
  },
  messageSender: {
    fontWeight: "700",
    color: "#fff",
    marginBottom: 2,
  },
  messageText: {
    color: "#fff",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#282828",
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    maxHeight: 100,
    marginRight: 10,
  },
});
