# 准备 docker build context:把模型权重复制到本目录
# docker build 不能跨目录引用,只能用当前目录及子目录的内容
$ErrorActionPreference = "Stop"
$srcRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\models\insightface")
$dst = Join-Path $PSScriptRoot "insightface"

if (Test-Path $dst) {
    Write-Host "[prepare] $dst 已存在,跳过复制(如需更新先 rm -r insightface)"
} else {
    Write-Host "[prepare] copy $srcRoot -> $dst"
    Copy-Item -Path $srcRoot -Destination $dst -Recurse
    Write-Host "[prepare] done"
}
