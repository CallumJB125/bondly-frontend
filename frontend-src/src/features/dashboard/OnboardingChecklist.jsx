import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './OnboardingChecklist.css';

const DISMISSED_KEY = 'bondly_checklist_dismissed';
const RATES_VIEWED_KEY = 'bondly_rates_viewed';

export default function OnboardingChecklist({ hasScore, hasLoans, hasApplication, onTabChange }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1');
  const [ratesViewed, setRatesViewed] = useState(() => !!localStorage.getItem(RATES_VIEWED_KEY));
  const [allDoneTimer, setAllDoneTimer] = useState(false);

  useEffect(() => {
    // Re-check rates viewed in case it was set in another tab
    const check = () => setRatesViewed(!!localStorage.getItem(RATES_VIEWED_KEY));
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  const steps = [
    {
      id: 'account',
      label: 'Create your account',
      done: true,
      cta: null,
    },
    {
      id: 'bond',
      label: 'Add your bond',
      done: hasLoans,
      cta: {
        label: 'Add bond →',
        action: () => onTabChange('bond'),
      },
    },
    {
      id: 'statement',
      label: 'Upload a bank statement',
      done: hasScore,
      cta: {
        label: 'Upload statement →',
        action: () => onTabChange('money'),
      },
    },
    {
      id: 'application',
      label: 'Submit a switch application',
      done: hasApplication,
      cta: {
        label: 'Start application →',
        action: () => onTabChange('switch'),
      },
    },
    {
      id: 'rates',
      label: 'Compare bank rates',
      done: ratesViewed,
      cta: {
        label: 'Compare rates →',
        action: () => {
          localStorage.setItem(RATES_VIEWED_KEY, '1');
          setRatesViewed(true);
          navigate('/optimize');
        },
      },
    },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const allDone = completedCount === steps.length;

  useEffect(() => {
    if (allDone && !dismissed) {
      const timer = setTimeout(() => {
        setDismissed(true);
        localStorage.setItem(DISMISSED_KEY, '1');
      }, 3000);
      setAllDoneTimer(true);
      return () => clearTimeout(timer);
    }
  }, [allDone, dismissed]);

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, '1');
  }

  return (
    <div className={`onboarding-checklist${allDone ? ' onboarding-checklist--done' : ''}`}>
      <div className="onboarding-checklist__header">
        <div className="onboarding-checklist__title">
          {allDone ? 'You\'re all set! 🎉' : 'Get started'}
        </div>
        <div className="onboarding-checklist__progress-label">
          {completedCount} of {steps.length} steps complete
        </div>
        <button className="onboarding-checklist__dismiss" onClick={dismiss} title="Dismiss">✕</button>
      </div>

      <div className="onboarding-checklist__bar">
        <div
          className="onboarding-checklist__bar-fill"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      {allDone ? (
        <p className="onboarding-checklist__done-msg">
          Your dashboard is fully set up. This will close in a moment…
        </p>
      ) : (
        <ul className="onboarding-checklist__steps">
          {steps.map(step => (
            <li key={step.id} className={`onboarding-checklist__step${step.done ? ' onboarding-checklist__step--done' : ''}`}>
              <span className="onboarding-checklist__step-icon" aria-hidden="true">
                {step.done ? '✓' : '○'}
              </span>
              <span className="onboarding-checklist__step-label">{step.label}</span>
              {!step.done && step.cta && (
                <button
                  className="onboarding-checklist__step-cta"
                  onClick={step.cta.action}
                >
                  {step.cta.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
