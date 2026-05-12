from typing import List, Optional

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="SBLE Performance Analytics Service")


class StudentPerformanceInput(BaseModel):
    student_id: str
    score: Optional[float] = 0.0
    total: Optional[float] = 0.0


class WeightedPerformanceInput(BaseModel):
    studentId: str
    assignmentAvg: float
    quizAvg: float
    examAvg: float
    completionRate: float
    finalScore: float
    grade: str
    status: str
    trend: str
    student_id: Optional[str] = None
    average_score: Optional[float] = None
    category: Optional[str] = None
    percentage: Optional[float] = None


class PerformanceRequest(BaseModel):
    students: Optional[List[StudentPerformanceInput]] = None
    performance: Optional[List[WeightedPerformanceInput]] = None


@app.post("/analyze-performance")
def analyze_performance(payload: PerformanceRequest):
    if payload.performance:
        # Already weighted by Node.js service; just normalize compatibility fields.
        performance = []
        for row in payload.performance:
            status = row.status or "Red"
            category = row.category or ("Orange" if status == "Amber" else status)

            performance.append({
                "studentId": row.studentId,
                "assignmentAvg": round(float(row.assignmentAvg or 0), 2),
                "quizAvg": round(float(row.quizAvg or 0), 2),
                "examAvg": round(float(row.examAvg or 0), 2),
                "completionRate": round(float(row.completionRate or 0), 4),
                "finalScore": round(float(row.finalScore or 0), 2),
                "grade": row.grade,
                "status": status,
                "trend": row.trend or "stable",
                "student_id": row.student_id or row.studentId,
                "average_score": round(float(row.average_score if row.average_score is not None else row.finalScore or 0), 2),
                "category": category,
                "percentage": round(float(row.percentage if row.percentage is not None else row.finalScore or 0), 2)
            })

        return {"performance": performance}

    students = payload.students or []
    performance = []

    for student in students:
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
            "category": "Orange" if category == "Amber" else category,
            "status": category,
            "grade": "A" if percentage >= 75 else "B" if percentage >= 60 else "C" if percentage >= 50 else "D" if percentage >= 40 else "F",
            "average_score": round(percentage, 2),
            "studentId": student.student_id,
            "assignmentAvg": round(percentage, 2),
            "quizAvg": 0.0,
            "examAvg": 0.0,
            "completionRate": 1.0,
            "finalScore": round(percentage, 2),
            "trend": "stable"
        })

    return {"performance": performance}


# Run with:
# uvicorn main:app --reload --port 8000
