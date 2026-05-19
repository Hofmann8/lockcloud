"""文件 activity_type 的唯一真相源。

设计:
- 固定的 6 个业务枚举,新增需要改代码 + 发版
- NULL 代表"未分类",在前端渲染时呈现为"未分类"
- 与前端 lockcloud-frontend/lib/constants/activityTypes.ts 镜像保持一致
"""

from typing import Optional

ACTIVITY_TYPES: list[dict[str, str]] = [
    {"value": "regular_training", "display_name": "例训"},
    {"value": "internal_training", "display_name": "内训"},
    {"value": "team_building", "display_name": "团建"},
    {"value": "master_class", "display_name": "大师课"},
    {"value": "competition", "display_name": "比赛"},
    {"value": "special_event", "display_name": "特殊活动"},
]

ACTIVITY_TYPE_VALUES: frozenset[str] = frozenset(t["value"] for t in ACTIVITY_TYPES)

ACTIVITY_TYPE_DISPLAY: dict[str, str] = {
    t["value"]: t["display_name"] for t in ACTIVITY_TYPES
}


def is_valid_activity_type(value: Optional[str]) -> bool:
    """允许 None(未分类),或在白名单内的字符串。"""
    return value is None or value in ACTIVITY_TYPE_VALUES


def display_name_for(value: Optional[str]) -> str:
    """value=None 时返回'未分类',否则返回 display_name,未知值原样回传。"""
    if value is None:
        return "未分类"
    return ACTIVITY_TYPE_DISPLAY.get(value, value)
