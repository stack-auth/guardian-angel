'use client';

import { useEffect, useState } from 'react';
import {
  subscribeToAnimationState,
  startMovingAnimation,
  removeAnimation,
  startTalkingAnimation,
  type PlayerAnimationState,
} from './playerAnimations';

function ThoughtBubble({ message }: { message: string }) {
  return (
    <div className="thought-bubble">
      {message}
    </div>
  );
}

function PlayerSprite() {
  const [animationState, setAnimationState] = useState<PlayerAnimationState>({
    animation: 'idle',
    facingDirection: 'right',
  });

  useEffect(() => {
    const unsubscribe = subscribeToAnimationState((state) => {
      setAnimationState(state);
    });
    return unsubscribe;
  }, []);

  const isMoving = animationState.animation === 'moving';
  const isTalking = animationState.animation === 'talking';
  const facingLeft = animationState.facingDirection === 'left';

  return (
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-8 pixel-art"
      style={{
        transform: `translateX(-50%) translateY(2rem) ${facingLeft ? 'scaleX(-1)' : 'scaleX(1)'}`,
      }}
    >
      <div className={`relative ${isMoving ? 'animate-moving' : ''} ${isTalking ? 'animate-talking' : ''}`}>
        {/* Shadow - pixel style */}
        <div className="absolute left-1/2 top-full -translate-x-1/2 translate-y-0.5 w-3 h-0.5 bg-black/40 pixel-shadow" />

        {/* Thought Bubble */}
        {isTalking && animationState.message && (
          <ThoughtBubble message={animationState.message} />
        )}

        {/* Head - square pixel style */}
        <div className="w-4 h-4 bg-blue-400 border border-blue-900 relative z-10 pixel-head" style={{ borderRadius: '1px' }}>
          {/* Head highlight/shading - pixel style */}
          <div className="absolute top-0 left-0 w-2.5 h-1.5 bg-blue-300" style={{ borderRadius: '0' }} />
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" style={{ borderRadius: '0' }} />

          {/* Eyes - pixel style */}
          <div className="absolute left-0.5 top-1 w-1 h-1 bg-white border-[0.5px] border-blue-900" style={{ borderRadius: '0' }} />
          <div className="absolute right-0.5 top-1 w-1 h-1 bg-white border-[0.5px] border-blue-900" style={{ borderRadius: '0' }} />
        </div>

        {/* Body - square pixel style */}
        <div className="absolute left-1/2 top-4 -translate-x-1/2 w-4 h-4 bg-blue-500 border border-blue-900 pixel-body" style={{ borderRadius: '1px 1px 0 0' }}>
          {/* Body shading - pixel style */}
          <div className="absolute top-0 left-0 w-2.5 h-1.5 bg-blue-400" style={{ borderRadius: '0' }} />
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-700" style={{ borderRadius: '0' }} />
          <div className="absolute top-0 right-0 w-0.5 h-full bg-blue-700" style={{ borderRadius: '0' }} />
        </div>

        {/* Legs */}
        <div className="absolute left-1/2 top-8 -translate-x-1/2 flex gap-0.5 pixel-legs">
          {/* Left leg */}
          <div className={`w-1.5 h-2.5 bg-blue-600 border border-blue-900 pixel-leg-left`} style={{ borderRadius: '0 0 1px 1px' }}>
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-800" style={{ borderRadius: '0' }} />
          </div>
          {/* Right leg */}
          <div className={`w-1.5 h-2.5 bg-blue-600 border border-blue-900 pixel-leg-right`} style={{ borderRadius: '0 0 1px 1px' }}>
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-800" style={{ borderRadius: '0' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only trigger on number keys (0-9)
      if (event.key >= '0' && event.key <= '9') {
        const key = parseInt(event.key);

        switch (key) {
          case 1:
            // Move right
            startMovingAnimation('right');
            break;
          case 2:
            // Move left
            startMovingAnimation('left');
            break;
          case 3:
            // Idle/Remove animation
            removeAnimation();
            break;
          case 4:
            // Talking - Greeting
            startTalkingAnimation('Hello!');
            break;
          case 5:
            // Talking - Question
            startTalkingAnimation('How can I help you?');
            break;
          case 6:
            // Talking - Exclamation
            startTalkingAnimation('Wow!');
            break;
          case 7:
            // Talking - Statement
            startTalkingAnimation('This is great!');
            break;
          case 8:
            // Talking - Question
            startTalkingAnimation('What should we do?');
            break;
          case 9:
            // Talking - Exclamation
            startTalkingAnimation('Amazing!');
            break;
          case 0:
            // Talking - Long message
            startTalkingAnimation('Welcome to the village!');
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  return (
    <div
      className="min-h-screen w-full relative"
      style={{
        backgroundImage: 'url(/Map.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <PlayerSprite />
    </div>
  );
}
