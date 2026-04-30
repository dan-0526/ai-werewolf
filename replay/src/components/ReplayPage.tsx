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
import ModelAvatar from './ModelAvatar';

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
  const { preload, play: playAudio } = useAudioPlayer(dataDir);

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

  const isNight = isNightPhase(currentPhase);
  const themeClass = isNight ? 'theme-night' : 'theme-day';
  const layoutClass = layout === 'landscape' ? 'layout-landscape' : 'layout-portrait';

  // 当前发言玩家
  const speakingPlayer = speakingId != null
    ? meta.players.find((p) => p.id === speakingId)
    : undefined;

  // 中央内容：投票 > 系统消息 > 台词气泡
  const centerContent = useMemo(() => {
    if (currentPhase === 'day_vote' || currentPhase === 'day_revote') {
      return <VotePanel votes={votes} players={meta.players} />;
    }
    if (showSystemMsg && systemMsg) {
      return <SystemMessage content={systemMsg} visible />;
    }
    return null;
  }, [currentPhase, votes, showSystemMsg, systemMsg, meta.players]);

  const speechBubble = subtitle ? (
    <div className={`speech-bubble ${subtitle.isWolf ? 'wolf-chat' : ''} ${subtitle.isLastWords ? 'last-words' : ''}`}>
      <div className="speech-speaker">
        {speakingPlayer && (
          <div className="speech-avatar">
            <ModelAvatar modelKey={speakingPlayer.modelKey} size={40} />
          </div>
        )}
        <span className="speech-name">
          {subtitle.isLastWords && <span className="speech-tag last-words-tag">遗言</span>}
          {subtitle.isWolf && <span className="speech-tag wolf-tag">密谋</span>}
          {subtitle.speakerName}
        </span>
      </div>
      <div className="speech-text">{subtitle.text}</div>
    </div>
  ) : null;

  const LayoutComponent = layout === 'landscape' ? LandscapeLayout : PortraitLayout;

  return (
    <div className={`layout-root ${layoutClass} ${themeClass}`}>
      <div className="phase-header">
        <div className="phase-header-inner">
          <span className="phase-icon-small">{isNight ? '🌙' : '☀️'}</span>
          <span className="phase-day">第{currentDay}{isNight ? '晚' : '天'}</span>
          <span className="phase-label">{PHASE_LABELS[currentPhase] ?? currentPhase}</span>
        </div>
        <span className="phase-meta">存活 {meta.players.length - deadIds.size}/{meta.players.length}</span>
      </div>

      <LayoutComponent
        players={meta.players}
        speakingId={speakingId}
        deadIds={deadIds}
        centerContent={centerContent ?? speechBubble}
      />

      <PhaseTransition phase={currentPhase} day={currentDay} visible={showPhaseTransition} />
      <GameOverScreen winner={gameOver?.winner} summary={gameOver?.summary} players={meta.players} visible={!!gameOver} />

      <div className="controls">
        <button onClick={controls.toggle}>
          {timeline.isPlaying ? '⏸ 暂停' : '▶ 播放'}
        </button>
        <button onClick={() => controls.setSpeed(timeline.speed === 1 ? 1.5 : timeline.speed === 1.5 ? 2 : 1)}>
          {timeline.speed}x
        </button>
      </div>
    </div>
  );
};

export default ReplayPage;
