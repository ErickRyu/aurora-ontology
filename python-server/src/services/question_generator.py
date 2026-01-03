"""AI-powered comparison question generator."""

from openai import AsyncOpenAI
from typing import List, Dict, Any
import logging
import json

from ..api.schemas import (
    RetrievedInsight,
    ComparisonQuestion,
    QuestionType,
    GenerateQuestionsResponse,
)
from ..prompts.comparison_questions import SYSTEM_PROMPT, build_user_prompt

logger = logging.getLogger(__name__)


class QuestionGenerator:
    """Generate comparison questions using GPT-4."""

    def __init__(
        self,
        openai_api_key: str,
        model: str = "gpt-4-turbo-preview",
    ):
        self.client = AsyncOpenAI(api_key=openai_api_key)
        self.model = model

    async def generate(
        self,
        current_question: str,
        retrieved_insights: List[RetrievedInsight],
    ) -> GenerateQuestionsResponse:
        """
        Generate comparison questions based on the current Question
        and retrieved Insights.

        Args:
            current_question: The full content of the Question note
            retrieved_insights: List of related Insights from RAG

        Returns:
            GenerateQuestionsResponse with questions and token usage
        """
        if not retrieved_insights:
            return GenerateQuestionsResponse(
                questions=[
                    ComparisonQuestion(
                        type=QuestionType.AMPLIFY,
                        question="No related Insights found. What new understanding are you seeking with this question?",
                    )
                ],
                token_usage={"prompt": 0, "completion": 0},
            )

        # Build the prompt
        user_prompt = build_user_prompt(current_question, retrieved_insights)

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.7,
                max_tokens=1500,
                response_format={"type": "json_object"},
            )

            # Parse response
            content = response.choices[0].message.content
            parsed = json.loads(content)

            questions = []
            for q in parsed.get("questions", []):
                question_type = q.get("type", "amplify")
                try:
                    qtype = QuestionType(question_type)
                except ValueError:
                    qtype = QuestionType.AMPLIFY

                questions.append(ComparisonQuestion(
                    type=qtype,
                    insight_reference=q.get("insight_reference"),
                    quote=q.get("quote"),
                    question=q.get("question", ""),
                ))

            token_usage = {
                "prompt": response.usage.prompt_tokens,
                "completion": response.usage.completion_tokens,
            }

            logger.info(
                f"Generated {len(questions)} questions "
                f"(tokens: {token_usage['prompt']} + {token_usage['completion']})"
            )

            return GenerateQuestionsResponse(
                questions=questions,
                token_usage=token_usage,
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse GPT response: {e}")
            return GenerateQuestionsResponse(
                questions=[
                    ComparisonQuestion(
                        type=QuestionType.AMPLIFY,
                        question="Failed to generate questions. Please try again.",
                    )
                ],
                token_usage={"prompt": 0, "completion": 0},
            )
        except Exception as e:
            logger.error(f"Question generation failed: {e}")
            raise
