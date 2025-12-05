'use client';

import { useState } from 'react';

import { VoiceInput } from '@/components/ai/voice-input';
import { VoiceSettings } from '@/components/ai/voice-settings';
import { VoiceVisualizer } from '@/components/ai/voice-visualizer';
import { useVoiceInput } from '@/hooks/use-voice-input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function VoiceInputDemo() {
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const { isSupported, isListening, audioLevel, settings, updateSettings } =
    useVoiceInput({
      onResult: result => {
        if (result.isFinal) {
          setTranscripts(prev => [...prev, result.transcript]);
        }
      },
    });

  const handleTranscript = (transcript: string, isFinal: boolean) => {
    if (isFinal) {
      console.log('Final transcript:', transcript);
    } else {
      console.log('Interim transcript:', transcript);
    }
  };

  return (
    <div className='container mx-auto max-w-4xl space-y-6 py-8'>
      <div className='space-y-2'>
        <h1 className='text-3xl font-bold'>Voice Input Demo</h1>
        <p className='text-muted-foreground'>
          Test the AI voice input system with real-time transcription and audio
          visualization.
        </p>
      </div>

      {!isSupported && (
        <Card className='border-destructive bg-destructive/10'>
          <CardContent className='pt-6'>
            <p className='text-sm text-destructive'>
              Voice input is not supported in this browser. Please use Chrome,
              Edge, or Safari.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue='basic' className='w-full'>
        <TabsList className='grid w-full grid-cols-4'>
          <TabsTrigger value='basic'>Basic Input</TabsTrigger>
          <TabsTrigger value='visualizer'>Visualizer</TabsTrigger>
          <TabsTrigger value='settings'>Settings</TabsTrigger>
          <TabsTrigger value='history'>History</TabsTrigger>
        </TabsList>

        <TabsContent value='basic' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Voice Input Component</CardTitle>
              <CardDescription>
                Click the microphone to start recording. Your speech will be
                transcribed in real-time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VoiceInput
                onTranscript={handleTranscript}
                placeholder='Click the microphone and start speaking...'
                autoSubmit={false}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className='space-y-2'>
              <div className='flex items-center justify-between rounded-lg border p-3'>
                <span className='text-sm font-medium'>Status</span>
                <span className='text-sm text-muted-foreground'>
                  {isListening ? 'Recording...' : 'Idle'}
                </span>
              </div>
              <div className='flex items-center justify-between rounded-lg border p-3'>
                <span className='text-sm font-medium'>Audio Level</span>
                <span className='text-sm text-muted-foreground'>
                  {(audioLevel * 100).toFixed(0)}%
                </span>
              </div>
              <div className='flex items-center justify-between rounded-lg border p-3'>
                <span className='text-sm font-medium'>Language</span>
                <span className='text-sm text-muted-foreground'>
                  {settings.language}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='visualizer' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Audio Visualizers</CardTitle>
              <CardDescription>
                Different visualization styles for audio input levels.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='space-y-2'>
                <h4 className='text-sm font-medium'>Bars Visualizer</h4>
                <VoiceVisualizer
                  audioLevel={audioLevel}
                  isActive={isListening}
                  variant='bars'
                  className='h-24'
                />
              </div>

              <div className='space-y-2'>
                <h4 className='text-sm font-medium'>Wave Visualizer</h4>
                <VoiceVisualizer
                  audioLevel={audioLevel}
                  isActive={isListening}
                  variant='wave'
                  className='h-24'
                />
              </div>

              <div className='space-y-2'>
                <h4 className='text-sm font-medium'>Circle Visualizer</h4>
                <VoiceVisualizer
                  audioLevel={audioLevel}
                  isActive={isListening}
                  variant='circle'
                  className='h-48'
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='settings' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Voice Settings</CardTitle>
              <CardDescription>
                Configure voice input preferences and behavior.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VoiceSettings
                settings={settings}
                onSettingsChange={updateSettings}
                showPermissionStatus={true}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='history' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Transcription History</CardTitle>
              <CardDescription>
                All completed voice transcriptions from this session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transcripts.length === 0 ? (
                <p className='text-center text-sm text-muted-foreground'>
                  No transcriptions yet. Start speaking to see results here.
                </p>
              ) : (
                <div className='space-y-2'>
                  {transcripts.map((transcript, index) => (
                    <div
                      key={index}
                      className='rounded-lg border bg-muted/50 p-3'
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <p className='text-sm leading-relaxed'>{transcript}</p>
                        <span className='text-xs text-muted-foreground'>
                          #{index + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Feature List */}
      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-1'>
              <h4 className='text-sm font-medium'>Web Speech API</h4>
              <p className='text-sm text-muted-foreground'>
                Browser-native speech recognition with no external dependencies
              </p>
            </div>
            <div className='space-y-1'>
              <h4 className='text-sm font-medium'>Real-time Transcription</h4>
              <p className='text-sm text-muted-foreground'>
                See interim results as you speak with final transcription on
                completion
              </p>
            </div>
            <div className='space-y-1'>
              <h4 className='text-sm font-medium'>Audio Visualization</h4>
              <p className='text-sm text-muted-foreground'>
                Multiple visualization styles with live audio level detection
              </p>
            </div>
            <div className='space-y-1'>
              <h4 className='text-sm font-medium'>Multi-language Support</h4>
              <p className='text-sm text-muted-foreground'>
                Support for 10+ languages including English, Spanish, French,
                and more
              </p>
            </div>
            <div className='space-y-1'>
              <h4 className='text-sm font-medium'>Permission Handling</h4>
              <p className='text-sm text-muted-foreground'>
                Graceful microphone permission requests and status checking
              </p>
            </div>
            <div className='space-y-1'>
              <h4 className='text-sm font-medium'>Customizable Settings</h4>
              <p className='text-sm text-muted-foreground'>
                Configure continuous mode, interim results, auto-start, and more
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
