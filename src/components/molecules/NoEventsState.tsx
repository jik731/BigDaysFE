import { useNavigate } from "react-router-dom";
import { CalendarIcon } from "@heroicons/react/solid";
import { Button } from "../atoms/Button";

interface NoEventsStateProps {
  title?: string;
  message?: string;
  showButton?: boolean;
  Icon?: React.FC<React.SVGProps<SVGSVGElement>>;
}

export function NoEventsState({
  title = "No Events Yet",
  message = "Create your first event to get started with planning your big day!",
  showButton = true,
  Icon = CalendarIcon,
}: NoEventsStateProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-accent rounded-2xl p-8 text-center">
      <div className="max-w-md mx-auto">
        <div className="h-20 w-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-button grid place-items-center">
          <Icon className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
          {title}
        </h2>
        <p className="text-slate-600 dark:text-slate-300 mb-6">
          {message}
        </p>
        {showButton && (
          <Button
            onClick={() => navigate("/app/events?new=1")}
            className="inline-flex items-center gap-2"
          >
            <CalendarIcon className="h-5 w-5" />
            Create Your First Event
          </Button>
        )}
      </div>
    </div>
  );
}
