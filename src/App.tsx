import React from 'react';
import './App.css';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001/game');

socket.on('connect', () => {
  console.log("connected!");
  console.log(socket.id);
});

function removeDecimalPart(number: number): number {
  return Math.floor(number);
}

let paddlepos1:number;
let roomid:any;
let isSecondPlayer:number;
let chosenMode:string;
let leftcolor:string;
let rightcolor:string;

const Score = ({ leftScore, rightScore, lColor, rColor }: { leftScore: number; rightScore: number, lColor: string, rColor: string }) => {
  const leftScoreStyle: React.CSSProperties = {
    position: 'absolute',
    left: '15%',
    top: '0',
    textAlign: 'center',
    color: `${lColor}`,
    fontSize: '30rem',
    paddingTop: '5%',
    fontFamily: 'Arial, sans-serif',
    zIndex: 1,
    opacity: '0.3',
  };
  
  const rightScoreStyle: React.CSSProperties = {
    position: 'absolute',
    right: '15%',
    top: '0',
    textAlign: 'center',
    color: `${rColor}`,
    fontSize: '30rem',
    paddingTop: '5%',
    fontFamily: 'Arial, sans-serif',
    zIndex: 1,
    opacity: '0.3',
  };

  return (
    <>
      <div style={leftScoreStyle}>
        {leftScore}
      </div>
      <div style={rightScoreStyle}>
        {rightScore}
      </div>
    </>
  );
};


const Paddle = ({ color, pos }: { color: string; pos: string }) => {
  const paddleStyle: React.CSSProperties = {
    width: '1.375rem', // 22px
    height: '6.625rem', // 106px
    backgroundColor: color,
    position: 'relative',
    top: pos,
    boxShadow: `0 0 1.25rem ${color}`, // 20px
    borderRadius: '1.25rem', // 20px
    marginInline: '1.25rem', // 20px
    zIndex: 6,
  };

  return <div style={paddleStyle}></div>;
};


const Ball = ({}: {}) => {
  const [ballPos, setBallPos] = React.useState({x: 0, y: 0});
  
  
  const ballStyle: React.CSSProperties = {
    width: '1.5625rem', // 25px
    height: '1.5625rem', // 25px
    backgroundColor: 'white',
    borderRadius: '50%',
    position: 'relative',
    left: `${ballPos.x}rem`, 
    top: `${ballPos.y}rem`, 
    boxShadow: '0 0 1.25rem white' // 20px
  };
  
  React.useEffect(() => {
    socket.on('ballmove', function(newPosition) {
      setBallPos(isSecondPlayer === 2 ? {x: -newPosition.x, y: newPosition.y} : newPosition);
    });
  
    return () => {
      socket.off('ballmove');
    }
  }, []);

  return <div style={ballStyle}></div>;
};


function App() {
  const [firstPaddlePos, setFirstPaddlePos] = React.useState(0);
  const movePaddle = React.useRef(0);

  const [secondPaddlePos, setSecondPaddlePos] = React.useState(0);

  const [leftscore, setLeftScore] = React.useState(0);
  const [rightscore, setRightScore] = React.useState(0);

  const [gameOver, setGameOver] = React.useState(false);
  const [isGameReady, setIsGameReady] = React.useState(false);


  React.useEffect(() => {
    socket.on('leftscored', () => {
      setLeftScore((prevScore: number) => {
        const newScore = prevScore + 1;
        if (removeDecimalPart(newScore / 2) === 5) {
          setGameOver(true);
          window.location.reload();
          // let navigate = useNavigate();
          // navigate("/home");
          socket.emit('gameended');
        }
        return newScore;
      });
    });

    return () => {
      socket.off('leftscrored');
    }
  }, []);


  React.useEffect(() => {
    socket.on('rightscored', () => {
      setRightScore((prevScore: number) => {
        const newScore = prevScore + 1;
        if (removeDecimalPart(newScore / 2) === 5) {
          setGameOver(true);
          window.location.reload();
          // let navigate = useNavigate();
          // navigate("/home");
          socket.emit('gameended');
        }
        return newScore;
      });
    });

    return () => {
      socket.off('rightcrored');
    }
  }, []);


  const [gameMode, setGameMode] = React.useState<null | 'classic' | 'football'>(null);


  React.useEffect(() => {
    if (gameMode) {
      socket.emit('gameMode', gameMode);
    }
  }, [gameMode]);


  React.useEffect(() => {
    socket.on('startgame', ({room, SecondPlayer, chosen}) => {
      isSecondPlayer = SecondPlayer;
      chosenMode = chosen;
      if (chosenMode === "classic") {
        leftcolor = "#E15253";
        rightcolor = "#5699AF";
      }
      else if (chosenMode === "football") {
        leftcolor = "white";
        rightcolor = "white";
      }
      console.log("player status: ",isSecondPlayer);
      setIsGameReady(true);
      roomid = room;
    });

    return () => {
      socket.off('startgame');
    }
  }, []);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'w') {
        movePaddle.current = -0.2;
    } else if (e.key === 'ArrowDown' || e.key === 's') {
      movePaddle.current = 0.2;
    }
  };

  const handleKeyUp = () => {
    movePaddle.current = 0; // 7bess
  };

  React.useEffect(() => {
    const updatePaddlePosition = () => {
      if (!gameOver) {
        setFirstPaddlePos((prev) => {
          const newPosition = prev + movePaddle.current;
          let maxPos = 17.5;
          let minPos = -17.187;
          if (chosenMode === "football") {
            maxPos = 10;
            minPos = -10;
          }
          
          paddlepos1 = Math.min(Math.max(newPosition, minPos), maxPos);
          socket.emit('paddlemove', { room: roomid, pos: paddlepos1, SecondPlayer: isSecondPlayer });
          return paddlepos1;
        });
        
        requestAnimationFrame(updatePaddlePosition);
      }
      };
      
      if (!gameOver) {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        requestAnimationFrame(updatePaddlePosition);
      }
      
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }, [gameOver]);

    React.useEffect(() => {
      socket.on('paddlemove', function(newPosition) {
        setSecondPaddlePos(newPosition);
      });
    
      return () => {
        socket.off('paddlemove');
      }
    }, []);

  if (gameMode === null) {
    return (
      <div className="container">
        <button className='button-86' onClick={() => setGameMode('classic')}>classic</button>
        <button className='button-86' onClick={() => setGameMode('football')}>Football</button>
      </div>
    );
  }
  

  if (!isGameReady) {
    return (
      <div className='waiting-screen'>
        Waiting for another player... 
      </div>
    )
  }

  return (
    <div className={`table-${chosenMode}`}>
      <Paddle color="#E15253" pos={`${firstPaddlePos}rem`} />
      <Ball/>
      <Paddle color="#5699AF" pos={`${secondPaddlePos}rem`} />
      <Score leftScore={removeDecimalPart(leftscore / 2)} rightScore={removeDecimalPart(rightscore / 2)} lColor={leftcolor} rColor={rightcolor} />
      <div className="lineC">
        <div className="line"></div>
      </div>
    </div>
  );
}

export default App;

