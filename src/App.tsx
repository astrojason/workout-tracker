
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';

import './App.css'
import { daily, beginner } from './data/goals.json'
import logs from './data/stats.json';


function App() {
  const weight = 255.6;

  // Calculate current streak for steps and calories
  const stepsGoal = 8000;
  const caloriesGoal = 800;
  function getStreak(data: typeof logs, key: 'steps' | 'calories', goal: number) {
    let streak = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      if (typeof data[i][key] === 'number' && data[i][key] >= goal) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }
  const stepsStreak = getStreak(logs, 'steps', stepsGoal);
  const caloriesStreak = getStreak(logs, 'calories', caloriesGoal);

  // Helper to get last session value for a lift
  function getLastLift(lift: string): number | null {
    for (let i = logs.length - 1; i >= 0; i--) {
      const value = (logs[i] as Record<string, any>)[lift];
      if (typeof value === 'number') {
        return value;
      }
    }
    return null;
  }


  // Calculate next work set weights
  const nextSquatVal = getLastLift('squat') !== null ? getLastLift('squat')! + 2.75 : null;
  const nextBenchVal = getLastLift('bench') !== null ? getLastLift('bench')! + 5 : null;
  const nextRowVal = getLastLift('row') !== null ? getLastLift('row')! + 5 : null;
  const nextPressVal = getLastLift('press') !== null ? getLastLift('press')! + 2.5 : null;
  const nextDeadliftVal = getLastLift('deadlift') !== null ? getLastLift('deadlift')! + 10 : null;

  const nextSquat = nextSquatVal !== null ? nextSquatVal.toFixed(2) : 'N/A';
  const nextBench = nextBenchVal !== null ? nextBenchVal.toFixed(2) : 'N/A';
  const nextRow = nextRowVal !== null ? nextRowVal.toFixed(2) : 'N/A';
  const nextPress = nextPressVal !== null ? nextPressVal.toFixed(2) : 'N/A';
  const nextDeadlift = nextDeadliftVal !== null ? nextDeadliftVal.toFixed(2) : 'N/A';

  // Warm-up set calculation
  type WarmupSet = { reps: number, weight: string };
  function getWarmups(work: number|null, min: number): WarmupSet[] {
    if (work === null) return [];
    const mods = [
      { reps: 5, mod: 0.4 },
      { reps: 5, mod: 0.6 },
      { reps: 5, mod: 0.8 },
      { reps: 3, mod: 0.9 },
    ];
    return mods.map(({ reps, mod }) => {
      const w = Math.max(Math.round(work * mod / 5) * 5, min); // round to nearest 5
      return { reps, weight: w.toString() };
    });
  }
  const warmupSquat = getWarmups(nextSquatVal, 45);
  const warmupBench = getWarmups(nextBenchVal, 45);
  const warmupPress = getWarmups(nextPressVal, 45);
  const warmupDeadlift = getWarmups(nextDeadliftVal, 65);
  const warmupRow = getWarmups(nextRowVal, 65);

  return (
    <div>
      <h1 style={{marginBottom: '1.5em', fontSize: '2.2rem', letterSpacing: '0.01em'}}>Health Dashboard</h1>
      <div className="card" style={{marginBottom: '2em'}}>
        <h2 style={{marginTop: 0}}>Daily Goals</h2>
        <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.5em'}}>
          {Object.keys(daily).map((key) => (
            <li key={key} style={{minWidth: 120, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '0.7em 1.2em', margin: 0, fontWeight: 600, boxShadow: '0 1px 4px 0 rgba(0,0,0,0.08)'}}>
              <span style={{color: '#a3c9ff'}}>{key}</span>: {daily[key as keyof typeof daily]}
            </li>
          ))}
          {Object.keys(beginner).map((key) => {
            if (key === 'duration') {
              return (
                <li key={key} style={{minWidth: 120, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '0.7em 1.2em', margin: 0, fontWeight: 600, boxShadow: '0 1px 4px 0 rgba(0,0,0,0.08)'}}>
                  <span style={{color: '#a3c9ff'}}>target date</span>: 2026-03-03
                </li>
              );
            }
            return (
              <li key={key} style={{minWidth: 120, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '0.7em 1.2em', margin: 0, fontWeight: 600, boxShadow: '0 1px 4px 0 rgba(0,0,0,0.08)'}}>
                <span style={{color: '#a3c9ff'}}>{key}</span>: {Math.round(weight * (beginner[key as keyof typeof beginner] as number))}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="card">
        <h2>Steps</h2>
        <LineChart width={500} height={300} data={logs} style={{margin: '0 auto'}}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="steps" stroke="#5e9eff" strokeWidth={3} dot={{r: 4}} />
          <ReferenceLine y={8000} label="Goal" stroke="#ff5e5e" strokeDasharray="3 3" />
        </LineChart>
        <div style={{marginTop: '1em', fontWeight: 500, color: '#a3c9ff', fontSize: '1.1em'}}>
          Current streak: <span style={{color: '#fff'}}>{stepsStreak}</span> day{stepsStreak === 1 ? '' : 's'}
        </div>
      </div>

      <div className="card">
        <h2>Calories</h2>
        <LineChart width={500} height={300} data={logs} style={{margin: '0 auto'}}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="calories" stroke="#5e9eff" strokeWidth={3} dot={{r: 4}} />
          <ReferenceLine y={800} label="Goal" stroke="#ff5e5e" strokeDasharray="3 3" />
        </LineChart>
        <div style={{marginTop: '1em', fontWeight: 500, color: '#a3c9ff', fontSize: '1.1em'}}>
          Current streak: <span style={{color: '#fff'}}>{caloriesStreak}</span> day{caloriesStreak === 1 ? '' : 's'}
        </div>
      </div>

      <div className="card">
        <h2>Squat</h2>
        <LineChart width={500} height={300} data={logs} style={{margin: '0 auto'}}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="squat" stroke="#5e9eff" strokeWidth={3} dot={{r: 4}} />
          <ReferenceLine y={319.5} label="Goal" stroke="#ff5e5e" strokeDasharray="3 3" />
        </LineChart>
        <div style={{marginTop: '1em', fontWeight: 500, color: '#a3c9ff', fontSize: '1.1em'}}>
          Next work set: <span style={{color: '#fff'}}>{nextSquat}</span> lbs
        </div>
        <div style={{marginTop: '0.5em', color: '#a3c9ff', fontSize: '1em'}}>
          Warm-up sets:
          <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', gap: '1em', justifyContent: 'center'}}>
            {warmupSquat.map((set, i) => (
              <li key={i}>{set.reps} x {set.weight} lbs</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <h2>Bench</h2>
        <LineChart width={500} height={300} data={logs} style={{margin: '0 auto'}}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="bench" stroke="#5e9eff" strokeWidth={3} dot={{r: 4}} />
          <ReferenceLine y={256} label="Goal" stroke="#ff5e5e" strokeDasharray="3 3" />
        </LineChart>
        <div style={{marginTop: '1em', fontWeight: 500, color: '#a3c9ff', fontSize: '1.1em'}}>
          Next work set: <span style={{color: '#fff'}}>{nextBench}</span> lbs
        </div>
        <div style={{marginTop: '0.5em', color: '#a3c9ff', fontSize: '1em'}}>
          Warm-up sets:
          <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', gap: '1em', justifyContent: 'center'}}>
            {warmupBench.map((set, i) => (
              <li key={i}>{set.reps} x {set.weight} lbs</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <h2>Deadlift</h2>
        <LineChart width={500} height={300} data={logs} style={{margin: '0 auto'}}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="deadlift" stroke="#5e9eff" strokeWidth={3} dot={{r: 4}} />
          <ReferenceLine y={384} label="Goal" stroke="#ff5e5e" strokeDasharray="3 3" />
        </LineChart>
        <div style={{marginTop: '1em', fontWeight: 500, color: '#a3c9ff', fontSize: '1.1em'}}>
          Next work set: <span style={{color: '#fff'}}>{nextDeadlift}</span> lbs
        </div>
        <div style={{marginTop: '0.5em', color: '#a3c9ff', fontSize: '1em'}}>
          Warm-up sets:
          <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', gap: '1em', justifyContent: 'center'}}>
            {warmupDeadlift.map((set, i) => (
              <li key={i}>{set.reps} x {set.weight} lbs</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <h2>OHP</h2>
        <LineChart width={500} height={300} data={logs} style={{margin: '0 auto'}}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="press" stroke="#5e9eff" strokeWidth={3} dot={{r: 4}} />
          <ReferenceLine y={179} label="Goal" stroke="#ff5e5e" strokeDasharray="3 3" />
        </LineChart>
        <div style={{marginTop: '1em', fontWeight: 500, color: '#a3c9ff', fontSize: '1.1em'}}>
          Next work set: <span style={{color: '#fff'}}>{nextPress}</span> lbs
        </div>
        <div style={{marginTop: '0.5em', color: '#a3c9ff', fontSize: '1em'}}>
          Warm-up sets:
          <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', gap: '1em', justifyContent: 'center'}}>
            {warmupPress.map((set, i) => (
              <li key={i}>{set.reps} x {set.weight} lbs</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="card">
        <h2>Row</h2>
        <LineChart width={500} height={300} data={logs} style={{margin: '0 auto'}}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="row" stroke="#5e9eff" strokeWidth={3} dot={{r: 4}} />
          <ReferenceLine y={135} label="Goal" stroke="#ff5e5e" strokeDasharray="3 3" />
        </LineChart>
        <div style={{marginTop: '1em', fontWeight: 500, color: '#a3c9ff', fontSize: '1.1em'}}>
          Next work set: <span style={{color: '#fff'}}>{nextRow}</span> lbs
        </div>
        <div style={{marginTop: '0.5em', color: '#a3c9ff', fontSize: '1em'}}>
          Warm-up sets:
          <ul style={{listStyle: 'none', padding: 0, margin: 0, display: 'flex', gap: '1em', justifyContent: 'center'}}>
            {warmupRow.map((set, i) => (
              <li key={i}>{set.reps} x {set.weight} lbs</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App
