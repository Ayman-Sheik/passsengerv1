import React from "react";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false, // hide headers if you want
        tabBarActiveTintColor: "#2f95dc",
        tabBarInactiveTintColor: "gray",
      }}
    >
      <Tabs.Screen
        name="index" // corresponds to app/tabs/index.tsx or app/tabs/index.jsx
        options={{ title: "Home" }}
      />
      <Tabs.Screen
        name="messages" // corresponds to app/tabs/messages.tsx
        options={{ title: "Messages" }}
      />
    </Tabs>
  );
}
