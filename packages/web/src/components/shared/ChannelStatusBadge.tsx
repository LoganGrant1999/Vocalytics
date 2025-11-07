interface ChannelStatusBadgeProps {
  status: string;
  isConnected: boolean;
}

const ChannelStatusBadge = ({ status, isConnected }: ChannelStatusBadgeProps) => {
  const colorClasses = isConnected
    ? "bg-success/10 text-success"
    : "bg-destructive/10 text-destructive";

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${colorClasses}`}>
      {status}
    </div>
  );
};

export default ChannelStatusBadge;
