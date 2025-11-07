interface ChannelStatusBadgeProps {
  status: string;
}

const ChannelStatusBadge = ({ status }: ChannelStatusBadgeProps) => {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
      {status}
    </div>
  );
};

export default ChannelStatusBadge;
