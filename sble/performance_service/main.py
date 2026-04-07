from typing import List

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="SBLE Performance Analytics Service")


class StudentPerformanceInput(BaseModel):
    student_id: str
    score: float
    total: float


class PerformanceRequest(BaseModel):
    students: List[StudentPerformanceInput]


@app.post("/analyze-performance")
def analyze_performance(payload: PerformanceRequest):
    performance = []

    for student in payload.students:
        total = float(student.total or 0)
        score = float(student.score or 0)

        percentage = 0.0 if total <= 0 else (score / total) * 100

        if percentage >= 70:
            category = "Green"
        elif percentage >= 50:
            category = "Amber"
        else:
            category = "Red"

        performance.append({
            "student_id": student.student_id,
            "percentage": round(percentage, 2),
            "category": category
        })

    return {"performance": performance}


# Run with:
# uvicorn main:app --reload --port 8000
