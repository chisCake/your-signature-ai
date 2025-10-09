"use client";

import { Button } from '@/components/ui/button';
import SignatureDisplay from '@/components/canvas/signature-display';
import { useState, useEffect, useRef } from "react";
import { SignaturePoint } from '@/lib/types';
import Canvas, { CanvasRef } from '@/components/canvas/canvas';
import { LoaderCircle } from "lucide-react";
import { csvStringToPoints } from '@/lib/signature-utils';

const CANVAS_SIZE = `w-[480px] h-[360px]
                     sm:w-[480px] sm:h-[360px]
                     md:w-[600px] md:h-[450px]
                     lg:w-[480px] lg:h-[360px]
                     xl:w-[600px] xl:h-[450px]`;

export default function Home() {
  const [signatureData, setSignatureData] = useState<SignaturePoint[]>([]);
  const canvasRef = useRef<CanvasRef>(null);
  const [originalSignatureId, setOriginalSignatureId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const getNewSignature = () => {
    fetch("/api/forgery")
      .then(res => res.json())
      .then(data => {
        const points = csvStringToPoints(data.features_table);
        setOriginalSignatureId(data.id);
        setSignatureData(points);
      })
      .catch(error => {
        console.error("Error fetching signature:", error);
      });
  }

  useEffect(() => {
    getNewSignature();
  }, []);

  const handleSaveButtonClick = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const signatureData = canvas.getSignatureData();
      if (!signatureData || signatureData.length === 0) {
        alert("Нельзя сохранить пустую подпись");
        return;
      }

      const inputType = canvas.getInputType();
      setIsLoading(true);

      fetch("/api/forgery", {
        method: "POST",
        body: JSON.stringify({ originalSignatureId: originalSignatureId, forgedSignatureData: signatureData, inputType: inputType }),
      }).then(_res => _res.json()).then(() => {
        // TODO: результаты оценки моделью

        canvas.clear();
        getNewSignature();
      }).catch(error => {
        console.error("Error saving signature:", error);
      }).finally(() => {
        setIsLoading(false);
      });
    }
  };

  return (
    <>
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="flex flex-col justify-center gap-4 lg:flex-row">
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-2xl font-bold">Попытайтесь подделать эту подпись</h2>
            <SignatureDisplay signatureData={signatureData} disablePlayButton={true}
              canvasClassName={CANVAS_SIZE}
            />
          </div>
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-2xl font-bold">Воспроизведите подпись на холсте</h2>
            <Canvas ref={canvasRef}
              canvasClassName={CANVAS_SIZE}
            />
          </div>
        </div>
        <Button onClick={handleSaveButtonClick}>Сохранить</Button>
      </div>
      {isLoading && <div className="fixed inset-0 z-20 bg-black bg-opacity-50 w-full h-full flex items-center justify-center">
        <LoaderCircle className="w-10 h-10 animate-spin" />
      </div>}
    </>
  );
}
