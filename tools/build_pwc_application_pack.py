from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf"
OUT.mkdir(parents=True, exist_ok=True)

CV_PDF = OUT / "OPEN-THIS-Md-Rezaul-Karim-CV-PwC-clean-clickable-links.pdf"
CV_TXT = OUT / "Md-Rezaul-Karim-CV-PwC-Operations-Transformation.txt"
LETTER_TXT = OUT / "PwC-Operations-Transformation-motivation-letter-draft.txt"


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="Name",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=19,
        leading=22,
        textColor=colors.HexColor("#111111"),
        spaceAfter=2,
    )
)
styles.add(
    ParagraphStyle(
        name="Subtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=12,
        textColor=colors.HexColor("#333333"),
        alignment=TA_JUSTIFY,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="Section",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=13,
        textColor=colors.HexColor("#7A1F3D"),
        borderWidth=0,
        spaceBefore=8,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="Body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=10.8,
        alignment=TA_JUSTIFY,
        textColor=colors.HexColor("#222222"),
        spaceAfter=3,
    )
)
styles.add(
    ParagraphStyle(
        name="Role",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.8,
        leading=10.8,
        textColor=colors.HexColor("#111111"),
        alignment=TA_JUSTIFY,
        spaceBefore=3,
        spaceAfter=1,
    )
)
styles.add(
    ParagraphStyle(
        name="Meta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.1,
        leading=10,
        textColor=colors.HexColor("#555555"),
        alignment=TA_JUSTIFY,
        spaceAfter=2,
    )
)
styles.add(
    ParagraphStyle(
        name="CvBullet",
        parent=styles["Body"],
        leftIndent=10,
        firstLineIndent=-6,
        bulletIndent=0,
        spaceAfter=1.4,
    )
)


def p(text, style="Body"):
    return Paragraph(text, styles[style])


def bullets(items):
    table = Table(
        [[p("-", "CvBullet"), p(item, "CvBullet")] for item in items],
        colWidths=[5 * mm, 159 * mm],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0.2),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#7A1F3D")),
            ]
        )
    )
    return table


def section(title):
    return p(title.upper(), "Section")


story = []
story.append(p("Md Rezaul Karim", "Name"))
story.append(
    p(
        "Master's Student, International Management & Information Systems | Operations Transformation, Process Optimization, Data & Analytics",
        "Subtitle",
    )
)
story.append(
    p(
        'Soest, Germany | myselfrezaul@gmail.com | +49 1577 3855748 | <u><a href="https://www.linkedin.com/in/myselfkarim/" color="#7A1F3D">LinkedIn</a></u> | <u><a href="https://myselfkarim.vercel.app/" color="#7A1F3D">Portfolio</a></u>',
        "Meta",
    )
)

story.append(section("Profile"))
story.append(
    p(
        "Master's student in International Management & Information Systems with two years of operational leadership experience and current project work across process optimization, SAP-based analytics, Agile coordination, and workflow automation. Comfortable translating business requirements into structured processes, KPI views, and implementation tasks for cross-functional teams. Seeking to contribute to PwC's Operations Transformation projects in areas such as Data & Analytics, Supply Chain, Procurement, Manufacturing & Service, and Operations Strategy.",
        "Body",
    )
)

story.append(section("PwC Operations Transformation Fit"))
fit_data = [
    [
        p("<b>Operations and process improvement</b><br/>Daily operations coordination, budget tracking, purchase orders, resource allocation, documentation, and workflow improvement.", "Body"),
        p("<b>Data, analytics, and ERP</b><br/>SAP BW/4HANA data warehousing, KPI reporting, Power BI, KNIME, data analysis, and SAP-integrated management coursework.", "Body"),
    ],
    [
        p("<b>Project work and consulting mindset</b><br/>Academic and consultancy projects using Jira, BPMN 2.0, and scalable tracking models to improve execution and stakeholder visibility.", "Body"),
        p("<b>Communication and delivery tools</b><br/>Microsoft Office 365, Excel, PowerPoint, Jira, Confluence, documentation, presentations, and bilingual English working capability; German A1, currently learning A2.", "Body"),
    ],
]
fit_table = Table(fit_data, colWidths=[82 * mm, 82 * mm], hAlign="LEFT")
fit_table.setStyle(
    TableStyle(
        [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#DDDDDD")),
            ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E8E8E8")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAFAFA")),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]
    )
)
story.append(fit_table)

story.append(section("Experience"))
story.append(p("Assistant Manager | Renaissance Diagnostic Care", "Role"))
story.append(p("07/2022 - 05/2024", "Meta"))
story.append(
    bullets(
        [
            "Coordinated day-to-day administrative operations and cross-functional communication to keep service workflows structured and reliable.",
            "Supported budget tracking, purchase order handling, and resource allocation, strengthening operational transparency and cost discipline.",
            "Organized internal documentation and operational assets in line with company guidelines, improving consistency and audit readiness.",
            "Identified recurring operational trends and supported management in implementing practical process improvements.",
        ]
    )
)

story.append(section("Selected Projects"))
story.append(p("SAP BW/4HANA: End-to-End Data Warehousing Project", "Role"))
story.append(p("08/2025", "Meta"))
story.append(
    bullets(
        [
            "Built a multi-layer Enterprise Data Warehouse structure in SAP HANA Studio, including DataSources, transformations, and ADSOs.",
            "Designed BW queries for KPI and sales trend analysis and configured master data hierarchies to support reliable business reporting.",
            "Connected technical data modeling with management decision needs, aligning with operations transformation and analytics use cases.",
        ]
    )
)

story.append(p("NexTep Edu | Consultancy", "Role"))
story.append(p("05/2025 - Present | https://www.nextepedu.com", "Meta"))
story.append(
    bullets(
        [
            "Mapped admission workflows with BPMN 2.0 and automated standard tasks, reducing manual processing time by 40%.",
            "Designed a self-service tracking model for student applications, lowering the need for repeated manual status updates.",
            "Created a scalable digital framework to handle, track, and organize client inquiries with lower maintenance effort.",
        ]
    )
)

story.append(p("Agile Event Coordination | Academic Project", "Role"))
story.append(p("03/2026 - Present", "Meta"))
story.append(
    bullets(
        [
            "Set up and managed Jira Kanban boards for large-scale university events, including alumni gatherings and IMIS Sports Day.",
            "Converted complex event logistics into actionable tickets and tracked progress from backlog to completion.",
            "Applied Agile routines to coordinate catering, team sign-ups, equipment sourcing, and stakeholder communication.",
        ]
    )
)

story.append(section("Education"))
edu = [
    [
        p("<b>Fachhochschule Suedwestfalen</b><br/>M.A. International Management & Information Systems", "Body"),
        p("03/2025 - Present<br/>Focus: SAP-integrated management, data analysis, digital transformation, information systems", "Body"),
    ],
    [
        p("<b>Govt. Haraganga College, Munshiganj</b><br/>Bachelor of Business Administration (BBA), grade 2.1", "Body"),
        p("10/2016 - 05/2022<br/>Focus: Business Statistics, IT, Operations & Supply Chain Management, Marketing, Financial Management", "Body"),
    ],
]
edu_table = Table(edu, colWidths=[76 * mm, 88 * mm], hAlign="LEFT")
edu_table.setStyle(
    TableStyle(
        [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]
    )
)
story.append(edu_table)

story.append(section("Skills"))
skills = [
    ["Operations & Transformation", "Process optimization, KPI analysis, budget tracking, asset organization, campaign monitoring, supply chain coursework"],
    ["Process & Project Tools", "SAP Signavio, BPMN 2.0, Jira, Confluence, Agile/Kanban coordination"],
    ["Data & ERP", "SAP BW/4HANA, SAP HANA Studio, Power BI, KNIME, data analysis, BW queries"],
    ["Productivity & Presentation", "Microsoft Office 365, Excel, PowerPoint, structured documentation and presentation preparation"],
    ["Technical", "GitHub, Vercel CI/CD, HTML5, CSS, Bootstrap"],
]
skill_table = Table(
    [[p(f"<b>{k}</b>", "Body"), p(v, "Body")] for k, v in skills],
    colWidths=[47 * mm, 117 * mm],
    hAlign="LEFT",
)
skill_table.setStyle(
    TableStyle(
        [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 1.2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2),
        ]
    )
)
story.append(skill_table)

story.append(section("Languages"))
story.append(p("Bengali: Native | English: Proficient (IELTS 7.0) | German: A1, currently learning A2", "Body"))

doc = SimpleDocTemplate(
    str(CV_PDF),
    pagesize=A4,
    rightMargin=17 * mm,
    leftMargin=17 * mm,
    topMargin=14 * mm,
    bottomMargin=16 * mm,
)
doc.build(story)

cv_text = """Md Rezaul Karim
Master's Student, International Management & Information Systems
Operations Transformation | Process Optimization | Data & Analytics
Soest, Germany | myselfrezaul@gmail.com | +49 1577 3855748 | LinkedIn | Portfolio: https://myselfkarim.vercel.app/

PROFILE
Master's student in International Management & Information Systems with two years of operational leadership experience and current project work across process optimization, SAP-based analytics, Agile coordination, and workflow automation. Comfortable translating business requirements into structured processes, KPI views, and implementation tasks for cross-functional teams. Seeking to contribute to PwC's Operations Transformation projects in areas such as Data & Analytics, Supply Chain, Procurement, Manufacturing & Service, and Operations Strategy.

PWC OPERATIONS TRANSFORMATION FIT
- Operations and process improvement: daily operations coordination, budget tracking, purchase orders, resource allocation, documentation, and workflow improvement.
- Data, analytics, and ERP: SAP BW/4HANA data warehousing, KPI reporting, Power BI, KNIME, data analysis, and SAP-integrated management coursework.
- Project work and consulting mindset: academic and consultancy projects using Jira, BPMN 2.0, and scalable tracking models to improve execution and stakeholder visibility.
- Communication and delivery tools: Microsoft Office 365, Excel, PowerPoint, Jira, Confluence, documentation, presentations, and bilingual English working capability; German A1, currently learning A2.

EXPERIENCE
Assistant Manager | Renaissance Diagnostic Care | 07/2022 - 05/2024
- Coordinated day-to-day administrative operations and cross-functional communication to keep service workflows structured and reliable.
- Supported budget tracking, purchase order handling, and resource allocation, strengthening operational transparency and cost discipline.
- Organized internal documentation and operational assets in line with company guidelines, improving consistency and audit readiness.
- Identified recurring operational trends and supported management in implementing practical process improvements.

SELECTED PROJECTS
SAP BW/4HANA: End-to-End Data Warehousing Project | 08/2025
- Built a multi-layer Enterprise Data Warehouse structure in SAP HANA Studio, including DataSources, transformations, and ADSOs.
- Designed BW queries for KPI and sales trend analysis and configured master data hierarchies to support reliable business reporting.
- Connected technical data modeling with management decision needs, aligning with operations transformation and analytics use cases.

NexTep Edu | Consultancy | 05/2025 - Present | https://www.nextepedu.com
- Mapped admission workflows with BPMN 2.0 and automated standard tasks, reducing manual processing time by 40%.
- Designed a self-service tracking model for student applications, lowering the need for repeated manual status updates.
- Created a scalable digital framework to handle, track, and organize client inquiries with lower maintenance effort.

Agile Event Coordination | Academic Project | 03/2026 - Present
- Set up and managed Jira Kanban boards for large-scale university events, including alumni gatherings and IMIS Sports Day.
- Converted complex event logistics into actionable tickets and tracked progress from backlog to completion.
- Applied Agile routines to coordinate catering, team sign-ups, equipment sourcing, and stakeholder communication.

EDUCATION
Fachhochschule Suedwestfalen | M.A. International Management & Information Systems | 03/2025 - Present
Focus: SAP-integrated management, data analysis, digital transformation, information systems.

Govt. Haraganga College, Munshiganj | Bachelor of Business Administration (BBA), grade 2.1 | 10/2016 - 05/2022
Focus: Business Statistics, IT, Operations & Supply Chain Management, Marketing, Financial Management.

SKILLS
Operations & Transformation: Process optimization, KPI analysis, budget tracking, asset organization, campaign monitoring, supply chain coursework
Process & Project Tools: SAP Signavio, BPMN 2.0, Jira, Confluence, Agile/Kanban coordination
Data & ERP: SAP BW/4HANA, SAP HANA Studio, Power BI, KNIME, data analysis, BW queries
Productivity & Presentation: Microsoft Office 365, Excel, PowerPoint, structured documentation and presentation preparation
Technical: GitHub, Vercel CI/CD, HTML5, CSS, Bootstrap

LANGUAGES
Bengali: Native | English: Proficient (IELTS 7.0) | German: A1, currently learning A2
"""
CV_TXT.write_text(cv_text, encoding="utf-8")

letter = """Subject: Application - Praktikum / Werkstudent Operations Transformation (w/m/d)

Dear PwC Recruiting Team,

I would like to apply for the Praktikum / Werkstudent Operations Transformation position. I am currently pursuing my Master's degree in International Management & Information Systems at Fachhochschule Suedwestfalen, where my focus includes SAP-integrated management, data analysis, digital transformation, and information systems.

What attracts me to PwC's Operations Transformation team is the combination of process improvement, data-driven decision-making, and implementation work across areas such as Data & Analytics, Supply Chain, Procurement, Manufacturing & Service, and Operations Strategy. My experience as an Assistant Manager taught me how operational performance depends on clear workflows, reliable documentation, budget discipline, and coordinated communication across teams.

In parallel with my studies, I have built practical transformation experience through projects such as SAP BW/4HANA data warehousing, BPMN 2.0 workflow automation for NexTep Edu, and Agile event coordination using Jira Kanban boards. These projects strengthened my ability to structure complex requirements, translate them into actionable tasks, and support teams with transparent reporting and practical delivery tools.

I am fluent in Bengali, proficient in English with IELTS 7.0, and currently improving my German from A1 toward A2. I would be glad to contribute my analytical mindset, process orientation, and hands-on project experience to PwC while continuing to develop in a challenging and collaborative consulting environment.

Kind regards,
Md Rezaul Karim
"""
LETTER_TXT.write_text(letter, encoding="utf-8")

print(CV_PDF)
print(CV_TXT)
print(LETTER_TXT)
