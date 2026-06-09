'use client';
import { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';

export default function Live2DViewer({ modelPath }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  // 只加载 Cubism4 核心
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const load = async () => {
      if (!window.Live2DCubismCore) {
        await new Promise((resolve) => {
          const s = document.createElement('script');
          s.src = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js';
          s.onload = resolve;
          document.head.appendChild(s);
        });
      }
      setReady(true);
    };

    load();
  }, []);

  // 初始化模型 + 鼠标互动
  useEffect(() => {
    if (!ready) return;
    window.PIXI = PIXI;

    const init = async () => {

      const { Live2DModel } = await import('pixi-live2d-display/cubism4');

      const app = new PIXI.Application({
        backgroundAlpha: 0,
        resizeTo: containerRef.current,
      });
      containerRef.current.appendChild(app.view);

      const model = await Live2DModel.from(modelPath);
      model.anchor.set(0.5);
      // 在 init 函数内，设置模型位置
      // 在 init 函数内部，app 创建后
      model.position.set(
        app.screen.width / 2,
        app.screen.height * 0.38  // 原来可能是 0.5 或 0.65，调整到这里
      );
      model.scale.set(0.3);
      app.stage.addChild(model);

      window.live2dModel = model;
      const core = model.internalModel.coreModel;

      // 鼠标移动转头
      window.addEventListener('mousemove', (e) => {
        const w = innerWidth;
        const h = innerHeight;
        const nx = (e.clientX / w) * 2 - 1;
        const ny = (e.clientY / h) * 2 - 1;

        core.setParameterValueById('ParamAngleY', nx * 30);
        core.setParameterValueById('ParamAngleX', -ny * 20);
        core.setParameterValueById('ParamEyeBallX', nx * 1);
        core.setParameterValueById('ParamEyeBallY', -ny * 0.5);
      });

      // 点击眨眼
      window.addEventListener('click', () => {
        core.setParameterValueById('ParamEyeLOpen', 0);
        core.setParameterValueById('ParamEyeROpen', 0);
        setTimeout(() => {
          core.setParameterValueById('ParamEyeLOpen', 1);
          core.setParameterValueById('ParamEyeROpen', 1);
        }, 150);
      });
      //恢复默认

      window.addEventListener('mouseout', () => {
        core.setParameterValueById('ParamAngleY', 0);
        core.setParameterValueById('ParamAngleX', 0);
        core.setParameterValueById('ParamEyeBallX', 0);
        core.setParameterValueById('ParamEyeBallY', 0);
      });

      
    };

    init();
  }, [ready, modelPath]);

  // 原来的 return 部分改成这样
return (
  <div
    ref={containerRef}
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 0,            // 放在最底层
      pointerEvents: 'none', // 让点击穿透，不影响按钮
    }}
  />
);
}