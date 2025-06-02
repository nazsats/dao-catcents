// components/ProgressBar.tsx
interface ProgressBarProps {
  yesVotes: number;
  noVotes: number;
}

export default function ProgressBar({ yesVotes, noVotes }: ProgressBarProps) {
  const totalVotes = yesVotes + noVotes;
  const yesPercentage = totalVotes > 0 ? (yesVotes / totalVotes) * 100 : 0;
  const noPercentage = totalVotes > 0 ? (noVotes / totalVotes) * 100 : 0;

  return (
    <div className="space-y-2">
      <div>
        <div className="flex justify-between text-xs text-gray-300 mb-1">
          <span>Yes: {yesVotes}</span>
          <span>{yesPercentage.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2 md:h-3 overflow-hidden">
          <div className="bg-green-500 h-full" style={{ width: `${yesPercentage}%` }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-300 mb-1">
          <span>No: {noVotes}</span>
          <span>{noPercentage.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2 md:h-3 overflow-hidden">
          <div className="bg-red-500 h-full" style={{ width: `${noPercentage}%` }} />
        </div>
      </div>
    </div>
  );
}