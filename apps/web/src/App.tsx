import { Link, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.js';
import NewJob from './pages/NewJob.js';
import JobDashboard from './pages/JobDashboard.js';
import { Meta } from './components/ui.js';

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export default function App() {
  return (
    <div className="mx-auto max-w-screen-xl px-4 pb-16">
      <header className="border-b-4 border-foreground">
        <div className="flex items-baseline justify-between pt-6 pb-1">
          <Meta>Vol. 1 — The Coordination Desk</Meta>
          <Meta>{today}</Meta>
        </div>
        <div className="flex items-end justify-between pb-3">
          <Link
            to="/"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
          >
            <h1 className="font-serif text-6xl font-black leading-[0.9] tracking-tighter sm:text-7xl">
              TARO
            </h1>
          </Link>
          <p className="hidden pb-2 font-body text-sm italic text-neutral-600 sm:block">
            Autonomous multi-party coordination, gated by humans.
          </p>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/jobs/new" element={<NewJob />} />
        <Route path="/jobs/:jobId" element={<JobDashboard />} />
      </Routes>
    </div>
  );
}
