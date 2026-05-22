import { useNavigate } from "react-router-dom";
import {
  HomeIcon,
  CalendarIcon,
  ClipboardListIcon,
  QuestionMarkCircleIcon,
  UserGroupIcon,
  ViewBoardsIcon,
  TemplateIcon,
  CurrencyDollarIcon,
  QrcodeIcon,
  UserIcon,
  BriefcaseIcon,
} from "@heroicons/react/solid";
import { TOURS, type TourIconKey } from "../../tour/tours";
import { Card } from "../../molecules/Card";
import { Button } from "../../atoms/Button";

const ICONS: Record<TourIconKey, React.FC<React.SVGProps<SVGSVGElement>>> = {
  home: HomeIcon,
  calendar: CalendarIcon,
  rsvps: ClipboardListIcon,
  questions: QuestionMarkCircleIcon,
  guests: UserGroupIcon,
  tables: ViewBoardsIcon,
  floorplan: TemplateIcon,
  wallet: CurrencyDollarIcon,
  checkin: QrcodeIcon,
  users: UserIcon,
  crew: BriefcaseIcon,
};

export default function TutorialPage() {
  const navigate = useNavigate();

  const handleStart = (routePath: string) => {
    navigate(`${routePath}?tour=1`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-primary">Tutorials</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Take a guided tour of any feature. Each tour spotlights the live UI so you learn by doing.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOURS.map((tour) => {
          const Icon = ICONS[tour.icon] ?? HomeIcon;
          return (
            <Card
              key={tour.routePath}
              className="flex flex-col gap-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-secondary text-white grid place-items-center flex-shrink-0 shadow-md shadow-primary/20">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-text dark:text-white">
                    {tour.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {tour.description}
                  </p>
                </div>
              </div>
              <div className="mt-auto flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>
                  {tour.steps.length} step{tour.steps.length === 1 ? "" : "s"}
                </span>
                <Button variant="primary" onClick={() => handleStart(tour.routePath)}>
                  Start tour
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
