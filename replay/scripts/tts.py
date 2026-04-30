#!/usr/bin/env python3
"""Edge TTS 批量语音生成脚本

用法: python3 tts.py <tasks.json>

tasks.json 格式:
[
  { "text": "要合成的文本", "voice": "zh-CN-YunxiNeural", "output": "output/001.mp3" },
  ...
]
"""

import asyncio
import json
import sys
import os

import edge_tts

CONCURRENCY = 3
MAX_RETRIES = 3


async def generate_one(task: dict, semaphore: asyncio.Semaphore, index: int) -> dict:
    """生成单条语音，带重试"""
    async with semaphore:
        output_path = task["output"]
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        for attempt in range(MAX_RETRIES):
            try:
                communicate = edge_tts.Communicate(task["text"], task["voice"])
                await communicate.save(output_path)

                # 检查文件是否生成且非空
                if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                    return {"file": output_path, "status": "ok", "index": index}

                # 文件为空，重试
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(1 * (attempt + 1))
                    continue

            except Exception as e:
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(1 * (attempt + 1))
                    continue
                return {"file": output_path, "status": "error", "index": index, "error": str(e)}

        return {"file": output_path, "status": "error", "index": index, "error": "empty file after retries"}


async def main():
    if len(sys.argv) < 2:
        print("用法: python3 tts.py <tasks.json>", file=sys.stderr)
        sys.exit(1)

    tasks_file = sys.argv[1]
    with open(tasks_file, "r", encoding="utf-8") as f:
        tasks = json.load(f)

    print(f"共 {len(tasks)} 条语音任务，并发数 {CONCURRENCY}，最大重试 {MAX_RETRIES}")

    semaphore = asyncio.Semaphore(CONCURRENCY)
    results = await asyncio.gather(
        *[generate_one(task, semaphore, i) for i, task in enumerate(tasks)],
        return_exceptions=True,
    )

    success = sum(1 for r in results if isinstance(r, dict) and r.get("status") == "ok")
    failed = len(results) - success
    print(f"完成: {success} 成功, {failed} 失败")

    if failed > 0:
        for r in results:
            if isinstance(r, Exception):
                print(f"  异常: {r}", file=sys.stderr)
            elif isinstance(r, dict) and r.get("status") != "ok":
                print(f"  任务 {r.get('index')}: {r.get('error')}", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())
