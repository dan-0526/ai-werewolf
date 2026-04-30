import { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReplayMeta, ReplayEvent, Faction } from '../types';
import { isNightPhase, PHASE_LABELS, ROLE_CONFIG } from '../types';
import { useTimeline } from '../hooks/useTimeline';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import LandscapeLayout from '../layouts/LandscapeLayout';
import PortraitLayout from '../layouts/PortraitLayout';
import PhaseTransition from './PhaseTransition';
import SystemMessage from './SystemMessage';
import VotePanel from './VotePanel';
import GameOverScreen from './GameOverScreen';

interface Props {
  meta: ReplayMeta;
  events: ReplayEvent[];
  dataDir: string;
  layout: 'landscape' | 'portrait';
}

interface SubtitleState {
  speakerName: string;
  text: string;
  isWolf: boolean;
  isLastWords: boolean;
}

const ReplayPage: FC<Props> = ({ meta, events, dataDir, layout }) => {
  const { preload, play: playAudio, stop: stopAudio } = useAudioPlayer(dataDir);

  const [currentPhase, setCurrentPhase] = useState<string>('init');
  const [currentDay, setCurrentDay] = useState(1);
  const [showPhaseTransition, setShowPhaseTransition] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | undefined>();
  const [subtitle, setSubtitle] = useState<SubtitleState | null>(null);
  const [systemMsg, setSystemMsg] = useState<string>('');
  const [showSystemMsg, setShowSystemMsg] = useState(false);
  const [votes, setVotes] = useState<{ voterId: number; targetId: number }[]>([]);
  const [deadIds, setDeadIds] = useState<Set<number>>(new Set());
  const [gameOver, setGameOver] = useState<{ winner: Faction; summary: string } | null>(null);

  useEffect(() => { preload(events); }, [events, preload]);

  const handleEvent = useCallback((event: ReplayEvent) => {
    const e = event.data;

    switch (e.type) {
      case 'phase_change': {
        setCurrentPhase(e.phase ?? 'init');
        setCurrentDay(e.day ?? 1);
        setShowPhaseTransition(true);
        setSubtitle(null);
        setSpeakingId(undefined);
        setShowSystemMsg(false);
        if (e.phase === 'day_vote' || e.phase === 'day_revote') setVotes([]);
        setTimeout(() => setShowPhaseTransition(false), 1800);
        break;
      }

      case 'player_speak':
      case 'wolf_chat': {
        const pid = e.playerId;
        const content = e.content ?? '';
        const isLastWords = content.startsWith('[遗言]');
        setSpeakingId(pid);
        setShowSystemMsg(false);
        setSubtitle({
          speakerName: e.playerName ?? `${pid}号`,
          text: isLastWords ? content.replace('[遗言] ', '') : content,
          isWolf: e.type === 'wolf_chat',
          isLastWords,
        });
        if (event.audio) playAudio(event.audio.file);
        break;
      }

      case 'system_message': {
        setSpeakingId(undefined);
        setSubtitle(null);
        setSystemMsg(e.content ?? '');
        setShowSystemMsg(true);
        if (event.audio) playAudio(event.audio.file);
        break;
      }

      case 'vote': {
        setSpeakingId(undefined);
        setSubtitle(null);
        setShowSystemMsg(false);
        if (e.voterId != null && e.targetId != null) {
          setVotes((prev) => [...prev, { voterId: e.voterId!, targetId: e.targetId! }]);
        }
        break;
      }

      case 'death': {
        if (e.playerId != null) {
          setDeadIds((prev) => new Set([...prev, e.playerId!]));
        }
        // 不清除字幕，让遗言可以紧接着显示
        break;
      }

      case 'action_result': {
        if (e.result) {
          setSystemMsg(e.result);
          setShowSystemMsg(true);
        }
        break;
      }

      case 'game_over': {
        setSpeakingId(undefined);
        setSubtitle(null);
        if (event.audio) playAudio(event.audio.file);
        setTimeout(() => {
          setGameOver({
            winner: (e.winner as Faction) ?? 'villager',
            summary: e.summary ?? '',
          });
        }, 2000);
        break;
      }
    }
  }, [playAudio]);

  const [timeline, controls] = useTimeline(events, handleEvent);

  const themeClass = isNightPhase(currentPhase) ? 'theme-night' : 'theme-day';

  // 中间内容区：只放投票和系统消息
  const centerContent = useMemo(() => {
    if (currentPhase === 'day_vote' || currentPhase === 'day_revote') {
      return <VotePanel votes={votes} players={meta.players} />;
    }
    if (showSystemMsg && systemMsg) {
      return <SystemMessage content={systemMsg} visible={true} />;
    }
    return null;
  }, [currentPhase, votes, showSystemMsg, systemMsg, meta.players]);

  // 底部字幕条
  const subtitleBar = subtitle ? (
    <div className={`subtitle-bar ${subtitle.isWolf ? 'wolf' : ''} ${subtitle.isLastWords ? 'last-words' : ''}`}>
      <span className="subtitle-speaker">
        {subtitle.isLastWords && <span className="subtitle-tag last-words-tag">遗言</span>}
        {subtitle.isWolf && <span className="subtitle-tag wolf-tag">🐺 密谋</span>}
        {subtitle.speakerName}
      </span>
      <span className="subtitle-text">{subtitle.text}</span>
    </div>
  ) : null;

  // 状态栏
  const statusBar = (
    <div className="status-bar">
      <span>第{currentDay}天</span>
      <span>{PHASE_LABELS[currentPhase] ?? currentPhase}</span>
      <span>存活: {meta.players.length - deadIds.size}/{meta.players.length}</span>
      <span>事件: {timeline.currentIndex + 1}/{events.length}</span>
    </div>
  );

  const overlay = (
    <>
      <PhaseTransition phase={currentPhase} day={currentDay} visible={showPhaseTransition} />
      <GameOverScreen winner={gameOver?.winner} summary={gameOver?.summary} players={meta.players} visible={!!gameOver} />
    </>
  );

  const controlsUI = (
    <div className="controls">
      <button onClick={controls.toggle}>
        {timeline.isPlaying ? '⏸ 暂停' : '▶ 播放'}
      </button>
      <button onClick={() => controls.setSpeed(timeline.speed === 1 ? 1.5 : timeline.speed === 1.5 ? 2 : 1)}>
        {timeline.speed}x
      </button>
    </div>
  );

  const layoutProps = {
    players: meta.players,
    speakingId,
    deadIds,
    centerContent,
    subtitleBar,
    statusBar,
    overlay: <>{overlay}{controlsUI}</>,
    themeClass,
  };

  return layout === 'portrait'
    ? <PortraitLayout {...layoutProps} />
    : <LandscapeLayout {...layoutProps} />;
};

export default ReplayPage;
