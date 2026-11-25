import { Platform } from 'react-native';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { graphqlClient } from '@/lib/graphql/client';
import { syncWidget } from './sync';

/** Refreshes the widget's payments now and then while the app is closed. */
export const WIDGET_REFRESH_TASK = 'finnit-widget-refresh';

/** Minutes; iOS decides when it actually runs (usually less often). */
const MINIMUM_INTERVAL = 240;

// Tasks must be defined when the JS bundle loads (also when iOS wakes the
// app in the background), so this module is imported by the root layout.
if (Platform.OS === 'ios') {
  TaskManager.defineTask(WIDGET_REFRESH_TASK, async () => {
    try {
      const updated = await syncWidget(graphqlClient);
      return updated
        ? BackgroundTask.BackgroundTaskResult.Success
        : BackgroundTask.BackgroundTaskResult.Failed;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Schedules the refresh (once is enough: iOS keeps it until it's unregistered). */
export async function registerWidgetRefresh(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(WIDGET_REFRESH_TASK)) return;
    await BackgroundTask.registerTaskAsync(WIDGET_REFRESH_TASK, {
      minimumInterval: MINIMUM_INTERVAL,
    });
  } catch {
    // Background refresh off for the app: the widget keeps its timeline.
  }
}
