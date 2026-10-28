from __future__ import annotations

import asyncio
import threading
import time

import pytest

from app.errors import ApiError
from app.main import JobRunner


def sleeper(seconds: float):
    def job(cancel: threading.Event) -> str:
        time.sleep(seconds)
        return "done"

    return job


def test_runs_one_job_at_a_time_and_reports_busy():
    async def scenario():
        runner = JobRunner(max_concurrency=1, queue_timeout_seconds=0.3)
        first = asyncio.create_task(runner.run(sleeper(0.8), timeout=5))
        await asyncio.sleep(0.05)
        with pytest.raises(ApiError) as busy:
            await runner.run(sleeper(0), timeout=5)
        assert busy.value.status == 503 and busy.value.code == "busy"
        assert await first == "done"
        assert await runner.run(sleeper(0), timeout=5) == "done"

    asyncio.run(scenario())


def test_timed_out_job_keeps_its_slot_until_it_finishes():
    async def scenario():
        runner = JobRunner(max_concurrency=1, queue_timeout_seconds=5)
        with pytest.raises(ApiError) as timeout:
            await runner.run(sleeper(0.6), timeout=0.2)
        assert timeout.value.status == 504
        # The slot is still taken by the running thread...
        assert runner.semaphore.locked()
        started = time.monotonic()
        assert await runner.run(sleeper(0), timeout=5) == "done"
        # ...so the next job only started once the first one finished.
        assert time.monotonic() - started >= 0.3

    asyncio.run(scenario())
