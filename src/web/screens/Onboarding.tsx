import { useState } from 'react';
import { LogoLarge } from '../Logo.tsx';
import { api, type Me } from '../api.ts';

export function OnboardingScreen({ me, onDone }: { me: Me; onDone: () => void }) {
  const [step, setStep] = useState(0);

  async function finish() {
    await api('/api/me/onboarded', {});
    onDone();
  }

  const steps = [
    {
      title: `היי ${me.firstName}, ברוכים הבאים`,
      body: (
        <p style={{ margin: 0 }}>
          אחרי כל אימון רושמים כמה הרמתם בכל תרגיל. זה לוקח דקה, ובפעם הבאה תראו מה הרמתם ויעד מומלץ להמשך.
        </p>
      ),
    },
    {
      title: 'בונים את האימון',
      body: (
        <p style={{ margin: 0 }}>
          פותחים אימון ליום, מוסיפים תרגילים מהספרייה (או תרגיל משלכם), וממלאים משקל וחזרות לכל סט. שיאים, גרפים ותגים מתעדכנים לבד.
        </p>
      ),
    },
    {
      title: 'כמו אפליקציה בטלפון',
      body: (
        <p style={{ margin: 0 }}>
          אפשר להוסיף את האפליקציה למסך הבית: באייפון בכפתור השיתוף ״הוספה למסך הבית״, ובאנדרואיד מתפריט הדפדפן.
        </p>
      ),
    },
  ];

  const s = steps[step];
  return (
    <div className="app">
      <div className="page center">
        <LogoLarge />
        <div className="card">
          <div className="step-num">{step + 1}</div>
          <h1 className="h2">{s.title}</h1>
          {s.body}
        </div>
        <div className="dots" aria-label={`שלב ${step + 1} מתוך ${steps.length}`}>
          {steps.map((_, i) => (
            <span key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>
        {step < steps.length - 1 ? (
          <button className="btn" onClick={() => setStep(step + 1)}>
            המשך
          </button>
        ) : (
          <button className="btn" onClick={finish}>
            יאללה, מתחילים
          </button>
        )}
      </div>
    </div>
  );
}
