import { Routes, Route } from "react-router-dom";
import DashboardLayout from "./components/layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Conversations from "./pages/Conversations";
import Knowledge from "./pages/Knowledge";
import Documents from "./pages/Documents";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat";
import ChatV2 from "./pages/ChatV2";
import PublicChat from "./pages/PublicChat";
import Agents from "./pages/Agents";
import Team from "./pages/Team";
import Settings from "./pages/Settings";
import Analytics from "./pages/Analytics";
import Integrations from "./pages/Integrations";
import Voice from "./pages/Voice";
import VoiceLab from "./pages/VoiceLab";
import OpenSourceVoiceLab from "./pages/OpenSourceVoiceLab";
import VoiceAgentsList from "./pages/voiceAgents/VoiceAgentsList";
import VoiceAgentCreate from "./pages/voiceAgents/VoiceAgentCreate";
import VoiceAgentDetail from "./pages/voiceAgents/VoiceAgentDetail";
import VoiceAgentTest from "./pages/voiceAgents/VoiceAgentTest";
import VoiceAgentCalls from "./pages/voiceAgents/VoiceAgentCalls";
import VoiceAgentAnalytics from "./pages/voiceAgents/VoiceAgentAnalytics";
import VoiceAgentSettings from "./pages/voiceAgents/VoiceAgentSettings";
import Appointments from "./pages/Appointments";
import TestingLab from "./pages/TestingLab";
import ReceptionistBuilder from "./pages/ReceptionistBuilder";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/chat/:slug" element={<PublicChat />} />
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/voice-agents" element={<VoiceAgentsList />} />
        <Route path="/voice-agents/create" element={<VoiceAgentCreate />} />
        <Route path="/voice-agents/:id" element={<VoiceAgentDetail />} />
        <Route path="/voice-agents/:id/test" element={<VoiceAgentTest />} />
        <Route path="/voice-agents/:id/calls" element={<VoiceAgentCalls />} />
        <Route path="/voice-agents/:id/analytics" element={<VoiceAgentAnalytics />} />
        <Route path="/voice-agents/:id/settings" element={<VoiceAgentSettings />} />
        <Route path="/build-receptionist" element={<ReceptionistBuilder />} />
        <Route path="/agents/builder" element={<ReceptionistBuilder />} />
        <Route path="/agents/builder/:id" element={<ReceptionistBuilder />} />
        <Route path="/agents/new" element={<ReceptionistBuilder />} />
        <Route path="/chat" element={<ChatV2 />} />
        <Route path="/chat/agent/:agentId" element={<ChatV2 />} />
        <Route path="/chat-classic" element={<Chat />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/voice" element={<Voice />} />
        <Route path="/voice/lab" element={<VoiceLab />} />
        <Route path="/voice-lab" element={<VoiceLab />} />
        <Route path="/voice/open-source" element={<OpenSourceVoiceLab />} />
        <Route path="/voice-open-source" element={<OpenSourceVoiceLab />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/lab" element={<TestingLab />} />
        <Route path="/team" element={<Team />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/conversations" element={<Conversations />} />
        <Route path="/conversations/:id" element={<Conversations />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/documents" element={<Documents />} />
      </Route>
    </Routes>
  );
}
