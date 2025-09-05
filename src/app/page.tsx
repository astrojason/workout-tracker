'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';
import { useEffect, useState } from 'react';

type GoalsData = {
  daily: { steps: number; calories: number };
  beginner: { squat: number; deadlift: number; press: number; bench: number };
};

type PlateData = { weight: number; quantity: number };

type LogData = {
  date: string;
  calories?: number;
  steps?: number;
  squat?: number;
  bench?: number;
  deadlift?: number;
  press?: number;
  row?: number;
};

export default function Home() {
  const [goalsData, setGoalsData] = useState<GoalsData | null>(null);
  const [platesData, setPlatesData] = useState<PlateData[]>([]);
  const [logs, setLogs] = useState<LogData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [goalsRes, platesRes, logsRes] = await Promise.all([
          fetch('/data/goals.json'),
          fetch('/data/plates.json'),
          fetch('/data/stats.json'),
        ]);

        const goals = await goalsRes.json();
        const plates = await platesRes.json();
        const logsData = await logsRes.json();

        setGoalsData(goals);
        setPlatesData(plates);
        setLogs(logsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading || !goalsData) {
    return (
      <div className="main-container">
        <h1>Loading...</h1>
      </div>
    );
  }

  const weight = 255.6;
  const { daily, beginner } = goalsData;

  // Plate calculation logic
  type Plate = { weight: number, quantity: number };
  const barWeight = 45;
  const availablePlates: Plate[] = Array.isArray(platesData)
    ? platesData.map(p => ({ weight: p.weight, quantity: p.quantity }))
    : [];

  function getPlateLoading(target: number): { total: number, perSide: number, breakdown: number[] } {
    let weightNeeded = target - barWeight;
    if (weightNeeded < 0) return { total: barWeight, perSide: 0, breakdown: [] };
    let best: number[] = [];
    let found = false;
    let minOver = Infinity;

    // Try to find the closest possible weight >= target
    function search(current: number, idx: number, used: number[], platesLeft: number[]): void {
      if (idx >= availablePlates.length) {
        if (current >= weightNeeded && current - weightNeeded < minOver) {
          minOver = current - weightNeeded;
          best = used.slice();
          found = true;
        }
        return;
      }
      const plate = availablePlates[idx];
      const maxPairs = Math.min(Math.floor(platesLeft[idx] / 2), Math.floor((weightNeeded - current) / (plate.weight * 2)) + 10);
      for (let count = 0; count <= maxPairs; count++) {
        used[idx] = count;
        search(current + count * plate.weight * 2, idx + 1, used, platesLeft);
      }
      used[idx] = 0;
    }
    search(0, 0, new Array(availablePlates.length).fill(0), availablePlates.map(p => p.quantity));
    let total = found ? best.reduce((sum: number, cnt: number, i: number) => sum + cnt * availablePlates[i].weight * 2, barWeight) : barWeight;
    let perSide = (total - barWeight) / 2;
    let breakdown: number[] = [];
    if (found) {
      best.forEach((cnt: number, i: number) => {
        for (let j = 0; j < cnt; j++) breakdown.push(availablePlates[i].weight);
      });
      breakdown.sort((a, b) => b - a);
    }
    return { total, perSide, breakdown };
  }

  function renderPlates(breakdown: number[]) {
    if (!breakdown.length) return <span style={{color:'#ff5e5e'}}>Bar only</span>;
    return breakdown.map((w, i) => (
      <span key={i} style={{marginRight: 2}}>
        {w}{i < breakdown.length - 1 ? <span style={{color:'#888'}}> - </span> : null}
      </span>
    ));
  }

  // Helper to render set with actual achievable weight
  function renderSetWithPlates(target: number|string) {
    const { total, breakdown } = getPlateLoading(Number(target));
    return <>
      <span style={{color: '#fff'}}>{total}</span> lbs
      <span style={{marginLeft: '1em', color: '#aaa', fontWeight: 400, fontSize: '0.95em'}}>
        [{renderPlates(breakdown)}]
      </span>
    </>;
  }

  // Calculate current streak for steps and calories
  const stepsGoal = 8000;
  const caloriesGoal = 800;
  function getStreak(data: typeof logs, key: 'steps' | 'calories', goal: number) {
    let streak = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      if (typeof data[i][key] === 'number' && data[i][key]! >= goal) {
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
    <div className="main-container">
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
        <div style={{display: 'flex', justifyContent: 'center', width: '100%'}}>
          <div style={{marginTop: '0.5em', color: '#a3c9ff', fontSize: '1em', textAlign: 'left', minWidth: 220}}>
            <div>Warm-up sets:</div>
            <ul style={{listStyle: 'none', padding: 0, margin: '0.5em 0 0 0', display: 'block'}}>
              {warmupSquat.map((set, i) => (
                <li key={i} style={{marginBottom: '0.3em'}}>
                  {set.reps} x {renderSetWithPlates(set.weight)}
                </li>
              ))}
            </ul>
            <div style={{marginTop: '1em', fontWeight: 500, color: '#a3c9ff', fontSize: '1.1em'}}>Work set: {renderSetWithPlates(nextSquat)}</div>
          </div>
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
        <div style={{display: 'flex', justifyContent: 'center', width: '100%'}}>
          <div style={{marginTop: '0.5em', color: '#a3c9ff', fontSize: '1em', textAlign: 'left', minWidth: 220}}>
            <div>Warm-up sets:</div>
            <ul style={{listStyle: 'none', padding: 0, margin: '0.5em 0 0 0', display: 'block'}}>
              {warmupBench.map((set, i) => (
                <li key={i} style={{marginBottom: '0.3em'}}>
                  {set.reps} x {renderSetWithPlates(set.weight)}
                </li>
              ))}
            </ul>
            <div style={{marginTop: '1em', fontWeight: 500, color: '#a3c9ff', fontSize: '1.1em'}}>Work set: {renderSetWithPlates(nextBench)}</div>
          </div>
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
        <div style={{display: 'flex', justifyContent: 'center', width: '100%'}}>
          <div style={{marginTop: '0.5em', color: '#a3c9ff', fontSize: '1em', textAlign: 'left', minWidth: 220}}>
            <div>Warm-up sets:</div>
            <ul style={{listStyle: 'none', padding: 0, margin: '0.5em 0 0 0', display: 'block'}}>
              {warmupDeadlift.map((set, i) => (
                <li key={i} style={{marginBottom: '0.3em'}}>
                  {set.reps} x {renderSetWithPlates(set.weight)}
                </li>
              ))}
            </ul>
            <div style={{marginTop: '1em', fontWeight: 500, color: '#a3c9ff', fontSize: '1.1em'}}>Work set: {renderSetWithPlates(nextDeadlift)}</div>
          </div>
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
        <div style={{display: 'flex', justifyContent: 'center', width: '100%'}}>
          <div style={{marginTop: '0.5em', color: '#a3c9ff', fontSize: '1em', textAlign: 'left', minWidth: 220}}>
            <div>Warm-up sets:</div>
            <ul style={{listStyle: 'none', padding: 0, margin: '0.5em 0 0 0', display: 'block'}}>
              {warmupPress.map((set, i) => (
                <li key={i} style={{marginBottom: '0.3em'}}>
                  {set.reps} x {renderSetWithPlates(set.weight)}
                </li>
              ))}
            </ul>
            <div style={{marginTop: '1em', fontWeight: 500, color: '#a3c9ff', fontSize: '1.1em'}}>Work set: {renderSetWithPlates(nextPress)}</div>
          </div>
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
        <div style={{display: 'flex', justifyContent: 'center', width: '100%'}}>
          <div style={{marginTop: '0.5em', color: '#a3c9ff', fontSize: '1em', textAlign: 'left', minWidth: 220}}>
            <div>Warm-up sets:</div>
            <ul style={{listStyle: 'none', padding: 0, margin: '0.5em 0 0 0', display: 'block'}}>
              {warmupRow.map((set, i) => (
                <li key={i} style={{marginBottom: '0.3em'}}>
                  {set.reps} x {renderSetWithPlates(set.weight)}
                </li>
              ))}
            </ul>
            <div style={{marginTop: '1em', fontWeight: 500, color: '#a3c9ff', fontSize: '1.1em'}}>Work set: {renderSetWithPlates(nextRow)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
