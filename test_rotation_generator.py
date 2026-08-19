#!/usr/bin/env python3

import argparse
from pathlib import Path

import cv2
import numpy as np


def rotate_image_3d(image, rot_x, rot_y, rot_z):
    h, w = image.shape[:2]

    rx = np.deg2rad(rot_x)
    ry = np.deg2rad(rot_y)
    rz = np.deg2rad(rot_z)

    Rx = np.array([
        [1, 0, 0],
        [0, np.cos(rx), -np.sin(rx)],
        [0, np.sin(rx),  np.cos(rx)],
    ])

    Ry = np.array([
        [ np.cos(ry), 0, np.sin(ry)],
        [0,           1, 0],
        [-np.sin(ry), 0, np.cos(ry)],
    ])

    Rz = np.array([
        [np.cos(rz), -np.sin(rz), 0],
        [np.sin(rz),  np.cos(rz), 0],
        [0,           0,          1],
    ])

    R = Rz @ Ry @ Rx

    corners = np.array([
        [-w / 2, -h / 2, 0],
        [ w / 2, -h / 2, 0],
        [ w / 2,  h / 2, 0],
        [-w / 2,  h / 2, 0],
    ], dtype=np.float64)

    rotated = corners @ R.T

    camera_distance = max(w, h) * 3.0

    projected = []
    for x, y, z in rotated:
        scale = camera_distance / (camera_distance - z)

        projected.append([
            x * scale + w / 2,
            y * scale + h / 2,
            ])

    projected = np.array(projected, dtype=np.float32)

    src = np.array([
        [0, 0],
        [w - 1, 0],
        [w - 1, h - 1],
        [0, h - 1],
    ], dtype=np.float32)

    # Find required output bounds
    min_x = np.floor(projected[:, 0].min())
    min_y = np.floor(projected[:, 1].min())
    max_x = np.ceil(projected[:, 0].max())
    max_y = np.ceil(projected[:, 1].max())

    out_w = int(max_x - min_x)
    out_h = int(max_y - min_y)

    # Shift projected coordinates so the whole image fits
    projected_shifted = projected.copy()
    projected_shifted[:, 0] -= min_x
    projected_shifted[:, 1] -= min_y

    transform = cv2.getPerspectiveTransform(src, projected_shifted)

    return cv2.warpPerspective(
        image,
        transform,
        (out_w, out_h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=(0, 0, 0, 0) if image.shape[2] == 4 else (0, 0, 0),
    )


def generate_matrices(x: list[int], y: list[int], z: list[int]) -> list[tuple[str, int, int, int]]:
    matrices:list[tuple[str, int, int, int]] = []

    def create_tuple(x_val, y_val, z_val) -> tuple[str, int, int, int]:
        return f"_{'X' if x_val != 0 else ''}{'Y' if y_val != 0 else ''}{'Z' if z_val != 0 else ''}_{x_val}_{y_val}_{z_val}", x_val, y_val, z_val

    for x_val in x:
        matrices.append(create_tuple(x_val, 0, 0))
    for y_val in y:
        matrices.append(create_tuple(0, y_val, 0))
    for z_val in z:
        matrices.append(create_tuple(0, 0, z_val))

    for i in range(1, min(len(x), len(y)), 2):
        matrices.append(create_tuple(x[i], y[i], 0))

    return matrices


def main():
    parser = argparse.ArgumentParser(
        description="Rotate an image around X/Y/Z axes."
    )
    parser.add_argument("image_path", nargs='?', type=Path, default="test_images/test_image.png")
    parser.add_argument("--x", nargs="*", type=int, default=[5,10,20,30], help="X rotation values")
    parser.add_argument("--y", nargs="*", type=int, default=[5,10,20,30], help="Y rotation values")
    parser.add_argument("--z", nargs="*", type=int, default=[15,30,45,90,180], help="Z rotation values")

    args = parser.parse_args()

    image = cv2.imread(str(args.image_path), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise SystemExit(f"Could not read image: {args.image_path}")

    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)

    matrices = generate_matrices(args.x, args.y, args.z)
    for suffix, x, y, z in matrices:
        rotated = rotate_image_3d(image, x, y, z)
        output_path = args.image_path.with_name(
            args.image_path.stem + suffix + args.image_path.suffix
        )
        cv2.imwrite(str(output_path), rotated)
    print(f"Saved {len(matrices)} rotated images to {args.image_path.parent}")



if __name__ == "__main__":
    main()