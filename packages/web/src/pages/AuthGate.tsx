import SignInPage from "./SignInPage";
import ConnectYouTubePage from "./ConnectYouTubePage";
import AppShell from "./AppShell";

interface AuthGateProps {
  isAuthed: boolean;
  hasYouTubeConnected: boolean;
  plan: "free" | "pro";
}

const AuthGate = ({ isAuthed, hasYouTubeConnected, plan }: AuthGateProps) => {
  // TODO: get isAuthed, hasYouTubeConnected, plan from GET /api/me
  
  if (!isAuthed) {
    return <SignInPage />;
  }

  if (isAuthed && !hasYouTubeConnected) {
    return <ConnectYouTubePage />;
  }

  return <AppShell plan={plan} channelName="TechByDylan"><div /></AppShell>;
};

export default AuthGate;
