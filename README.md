# Radial Gradient Nucleus Polygon Annotator

컬러 이미지를 업로드한 뒤 중심점을 찍으면 radial 방향으로 gradient boundary를 찾고, 사용자가 point를 보정해서 polygon annotation을 저장하는 도구입니다. 저장된 annotation은 Feret measurement XLSX와 모델 학습용 image/mask dataset으로 export할 수 있습니다.

## 주요 기능

- 컬러 이미지 업로드 또는 drag & drop
- 중심점 기준 radial gradient boundary detection
- point 수동 이동, 제외, 복원
- saved annotation 개별 표시/숨김, 편집, 삭제
- Feret average/min/max XLSX export
- 학습용 dataset 저장
  - `image/`: annotation 좌표와 같은 크기의 작업 이미지 PNG
  - `masks/`: saved polygon별 binary mask PNG
  - saved polygon 하나가 mask 객체 하나입니다.

## Docker로 실행

데이터 저장까지 포함한 권장 실행 방법입니다.

```bash
docker compose up --build
```

브라우저에서 엽니다.

```text
http://127.0.0.1:4173
```

Docker Compose는 host의 `./data`를 컨테이너 `/data`에 mount합니다. 컨테이너를 삭제해도 export 데이터는 프로젝트 폴더의 `data/` 아래에 남습니다.

## 로컬에서 실행

개발용 UI만 빠르게 확인할 때:

```bash
npm install
npm run dev
```

```text
http://127.0.0.1:5173
```

주의: `npm run dev`는 Vite 개발 서버만 실행합니다. 학습용 dataset을 서버에 저장하려면 Docker 실행을 사용하거나, production server를 실행하세요.

production server를 로컬에서 실행할 때:

```bash
npm install
npm run build
DATA_DIR=./data PORT=4173 npm start
```

```text
http://127.0.0.1:4173
```

## Dataset Export 구조

`Export XLSX` 버튼을 누르면 XLSX 다운로드와 함께 서버에도 dataset이 저장됩니다.

```text
data/
  2026-06-11_17-48-40_imageName/
    image/
      imageName.png
    masks/
      annotation_1.png
      annotation_2.png
    2026-06-11_17-48-40_imageName.xlsx
```

`masks/annotation_N.png`는 binary mask입니다.

- 검정 배경: background
- 흰색 polygon: annotation object
- annotation 하나당 mask 파일 하나

## 기본 사용법

1. 이미지를 클릭해서 업로드하거나 canvas로 drag & drop합니다.
2. 객체 중심을 클릭합니다.
3. boundary point를 확인하고 필요하면 수정합니다.
4. `S`를 눌러 annotation을 저장합니다.
5. 다른 객체 중심을 다시 클릭해서 추가 annotation을 만듭니다.
6. `Export XLSX`를 눌러 XLSX와 학습용 image/mask dataset을 저장합니다.

## 단축키

```text
S       Save current annotation
R       Remove hovered point, or hold/drag range to remove points
C       Move center to pointer
Esc     Cancel current edit
V       Hold to preview original image only
[ / ]   Move selected point inward/outward
```

## 측정값

현재 XLSX에는 다음 값만 저장됩니다.

- Avg Feret (um)
- Min Feret (um)
- Feret max (um)

`um per px` 기본값은 `2.2`이며, UI에서 바꿀 수 있습니다.

## 개발 명령어

```bash
npm test
npm run build
docker compose config
```

## 저장 API

앱은 `POST /api/export-dataset`으로 다음 데이터를 보냅니다.

- `imageFileName`
- `imageDataUrl`
- `xlsxDataUrl`
- `masks[]`
  - `fileName`
  - `dataUrl`

서버는 `DATA_DIR` 아래에 timestamp/image-name 폴더를 만들고 파일을 저장합니다.
