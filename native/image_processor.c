typedef unsigned char uint8_t;
typedef unsigned int uint32_t;
typedef __UINTPTR_TYPE__ uintptr_t;

#define CLUSTER_COUNT 8
#define KMEANS_ITERATIONS 6
#define BLUR_RADIUS 2
#define WASM_PAGE_SIZE 65536u

extern uint8_t __heap_base;

static uintptr_t heap_offset = 0;

static uint32_t align_up(uint32_t value, uint32_t alignment) {
  return (value + alignment - 1u) & ~(alignment - 1u);
}

void reset_allocator(void) {
  heap_offset = align_up((uint32_t)(uintptr_t)&__heap_base, 16u);
}

uint32_t allocate(uint32_t size) {
  uint32_t start;
  uint32_t end;
  uint32_t current_pages;
  uint32_t required_pages;

  if (heap_offset == 0) {
    reset_allocator();
  }

  start = (uint32_t)heap_offset;
  end = align_up(start + size, 16u);
  if (end < start) {
    return 0;
  }

  current_pages = (uint32_t)__builtin_wasm_memory_size(0);
  required_pages = (end + WASM_PAGE_SIZE - 1u) / WASM_PAGE_SIZE;
  if (required_pages > current_pages) {
    uint32_t grown_from = (uint32_t)__builtin_wasm_memory_grow(0, required_pages - current_pages);
    if (grown_from == 0xffffffffu) {
      return 0;
    }
  }

  heap_offset = (uintptr_t)end;
  return start;
}

static uint32_t pixel_offset(uint32_t pixel_index) {
  return pixel_index * 4u;
}

static uint32_t color_distance(
  uint8_t red,
  uint8_t green,
  uint8_t blue,
  const uint8_t palette[CLUSTER_COUNT][3],
  uint32_t cluster
) {
  int red_delta = (int)red - (int)palette[cluster][0];
  int green_delta = (int)green - (int)palette[cluster][1];
  int blue_delta = (int)blue - (int)palette[cluster][2];

  return (uint32_t)(
    red_delta * red_delta * 3 +
    green_delta * green_delta * 6 +
    blue_delta * blue_delta * 2
  );
}

static uint8_t nearest_cluster(
  uint8_t red,
  uint8_t green,
  uint8_t blue,
  const uint8_t palette[CLUSTER_COUNT][3]
) {
  uint32_t cluster;
  uint32_t best_cluster = 0;
  uint32_t best_distance = color_distance(red, green, blue, palette, 0);

  for (cluster = 1; cluster < CLUSTER_COUNT; cluster += 1) {
    uint32_t distance = color_distance(red, green, blue, palette, cluster);
    if (distance < best_distance) {
      best_distance = distance;
      best_cluster = cluster;
    }
  }

  return (uint8_t)best_cluster;
}

static void blur_image(const uint8_t *input, uint8_t *output, uint32_t width, uint32_t height) {
  uint32_t y;

  for (y = 0; y < height; y += 1) {
    uint32_t x;
    for (x = 0; x < width; x += 1) {
      uint32_t sums[3] = {0, 0, 0};
      uint32_t count = 0;
      int sample_y;

      for (sample_y = (int)y - BLUR_RADIUS; sample_y <= (int)y + BLUR_RADIUS; sample_y += 1) {
        int sample_x;
        if (sample_y < 0 || sample_y >= (int)height) {
          continue;
        }

        for (sample_x = (int)x - BLUR_RADIUS; sample_x <= (int)x + BLUR_RADIUS; sample_x += 1) {
          uint32_t offset;
          if (sample_x < 0 || sample_x >= (int)width) {
            continue;
          }

          offset = pixel_offset((uint32_t)sample_y * width + (uint32_t)sample_x);
          sums[0] += input[offset];
          sums[1] += input[offset + 1u];
          sums[2] += input[offset + 2u];
          count += 1;
        }
      }

      {
        uint32_t output_offset = pixel_offset(y * width + x);
        output[output_offset] = (uint8_t)(sums[0] / count);
        output[output_offset + 1u] = (uint8_t)(sums[1] / count);
        output[output_offset + 2u] = (uint8_t)(sums[2] / count);
        output[output_offset + 3u] = 255;
      }
    }
  }
}

static void initialize_palette(
  const uint8_t *pixels,
  uint32_t pixel_count,
  uint8_t palette[CLUSTER_COUNT][3]
) {
  uint32_t sample_step = pixel_count / 9000u;
  uint32_t darkest_index = 0;
  uint32_t brightest_index = 0;
  uint32_t darkest_luminance = 0xffffffffu;
  uint32_t brightest_luminance = 0;
  uint32_t index;

  if (sample_step == 0) {
    sample_step = 1;
  }

  for (index = 0; index < pixel_count; index += sample_step) {
    uint32_t offset = pixel_offset(index);
    uint32_t luminance =
      (uint32_t)pixels[offset] * 54u +
      (uint32_t)pixels[offset + 1u] * 183u +
      (uint32_t)pixels[offset + 2u] * 19u;

    if (luminance < darkest_luminance) {
      darkest_luminance = luminance;
      darkest_index = index;
    }
    if (luminance > brightest_luminance) {
      brightest_luminance = luminance;
      brightest_index = index;
    }
  }

  for (index = 0; index < 3; index += 1) {
    palette[0][index] = pixels[pixel_offset(darkest_index) + index];
    palette[1][index] = pixels[pixel_offset(brightest_index) + index];
  }

  {
    uint32_t cluster;
    for (cluster = 2; cluster < CLUSTER_COUNT; cluster += 1) {
      uint32_t farthest_index = 0;
      uint32_t farthest_distance = 0;

      for (index = 0; index < pixel_count; index += sample_step) {
        uint32_t offset = pixel_offset(index);
        uint32_t existing_cluster;
        uint32_t nearest_distance = 0xffffffffu;

        for (existing_cluster = 0; existing_cluster < cluster; existing_cluster += 1) {
          uint32_t distance = color_distance(
            pixels[offset],
            pixels[offset + 1u],
            pixels[offset + 2u],
            palette,
            existing_cluster
          );
          if (distance < nearest_distance) {
            nearest_distance = distance;
          }
        }

        if (nearest_distance > farthest_distance) {
          farthest_distance = nearest_distance;
          farthest_index = index;
        }
      }

      for (index = 0; index < 3; index += 1) {
        palette[cluster][index] = pixels[pixel_offset(farthest_index) + index];
      }
    }
  }
}

static void quantize_image(
  const uint8_t *pixels,
  uint8_t *assignments,
  uint32_t pixel_count,
  uint8_t palette[CLUSTER_COUNT][3]
) {
  uint32_t iteration;

  initialize_palette(pixels, pixel_count, palette);

  for (iteration = 0; iteration < KMEANS_ITERATIONS; iteration += 1) {
    uint32_t red_sums[CLUSTER_COUNT] = {0};
    uint32_t green_sums[CLUSTER_COUNT] = {0};
    uint32_t blue_sums[CLUSTER_COUNT] = {0};
    uint32_t counts[CLUSTER_COUNT] = {0};
    uint32_t index;

    for (index = 0; index < pixel_count; index += 1) {
      uint32_t offset = pixel_offset(index);
      uint8_t cluster = nearest_cluster(
        pixels[offset],
        pixels[offset + 1u],
        pixels[offset + 2u],
        palette
      );
      assignments[index] = cluster;
      red_sums[cluster] += pixels[offset];
      green_sums[cluster] += pixels[offset + 1u];
      blue_sums[cluster] += pixels[offset + 2u];
      counts[cluster] += 1;
    }

    for (index = 0; index < CLUSTER_COUNT; index += 1) {
      if (counts[index] == 0) {
        continue;
      }
      palette[index][0] = (uint8_t)(red_sums[index] / counts[index]);
      palette[index][1] = (uint8_t)(green_sums[index] / counts[index]);
      palette[index][2] = (uint8_t)(blue_sums[index] / counts[index]);
    }
  }
}

static void smooth_assignments(
  const uint8_t *source,
  uint8_t *destination,
  uint32_t width,
  uint32_t height
) {
  uint32_t y;

  for (y = 0; y < height; y += 1) {
    uint32_t x;
    for (x = 0; x < width; x += 1) {
      uint32_t counts[CLUSTER_COUNT] = {0};
      uint32_t best_cluster = source[y * width + x];
      int sample_y;

      for (sample_y = (int)y - 1; sample_y <= (int)y + 1; sample_y += 1) {
        int sample_x;
        if (sample_y < 0 || sample_y >= (int)height) {
          continue;
        }
        for (sample_x = (int)x - 1; sample_x <= (int)x + 1; sample_x += 1) {
          uint8_t cluster;
          if (sample_x < 0 || sample_x >= (int)width) {
            continue;
          }
          cluster = source[(uint32_t)sample_y * width + (uint32_t)sample_x];
          counts[cluster] += 1;
        }
      }

      {
        uint32_t cluster;
        for (cluster = 0; cluster < CLUSTER_COUNT; cluster += 1) {
          if (counts[cluster] > counts[best_cluster]) {
            best_cluster = cluster;
          }
        }
      }

      destination[y * width + x] = (uint8_t)best_cluster;
    }
  }
}

static int is_boundary(
  const uint8_t *assignments,
  uint32_t x,
  uint32_t y,
  uint32_t width,
  uint32_t height
) {
  uint8_t center = assignments[y * width + x];
  int sample_y;

  for (sample_y = (int)y - 1; sample_y <= (int)y + 1; sample_y += 1) {
    int sample_x;
    if (sample_y < 0 || sample_y >= (int)height) {
      continue;
    }
    for (sample_x = (int)x - 1; sample_x <= (int)x + 1; sample_x += 1) {
      if (sample_x < 0 || sample_x >= (int)width) {
        continue;
      }
      if (assignments[(uint32_t)sample_y * width + (uint32_t)sample_x] != center) {
        return 1;
      }
    }
  }

  return 0;
}

int process_image(
  uint8_t *input,
  uint8_t *flat_output,
  uint8_t *line_output,
  uint8_t *palette_output,
  uint32_t width,
  uint32_t height
) {
  uint32_t pixel_count;
  uint8_t palette[CLUSTER_COUNT][3];
  uint8_t *assignments;
  uint8_t *temporary_assignments;
  uint32_t index;

  if (!input || !flat_output || !line_output || !palette_output || width == 0 || height == 0) {
    return 1;
  }
  if (width > 4096u || height > 4096u || width > 0xffffffffu / height) {
    return 2;
  }

  pixel_count = width * height;
  assignments = line_output;
  temporary_assignments = input;

  blur_image(input, flat_output, width, height);
  quantize_image(flat_output, assignments, pixel_count, palette);
  smooth_assignments(assignments, temporary_assignments, width, height);
  smooth_assignments(temporary_assignments, assignments, width, height);
  smooth_assignments(assignments, temporary_assignments, width, height);

  for (index = 0; index < pixel_count; index += 1) {
    uint8_t cluster = temporary_assignments[index];
    uint32_t offset = pixel_offset(index);
    uint8_t line_value = is_boundary(
      temporary_assignments,
      index % width,
      index / width,
      width,
      height
    ) ? 31 : 255;

    flat_output[offset] = palette[cluster][0];
    flat_output[offset + 1u] = palette[cluster][1];
    flat_output[offset + 2u] = palette[cluster][2];
    flat_output[offset + 3u] = 255;

    line_output[offset] = line_value;
    line_output[offset + 1u] = line_value;
    line_output[offset + 2u] = line_value;
    line_output[offset + 3u] = 255;
  }

  for (index = 0; index < CLUSTER_COUNT; index += 1) {
    uint32_t offset = index * 4u;
    palette_output[offset] = palette[index][0];
    palette_output[offset + 1u] = palette[index][1];
    palette_output[offset + 2u] = palette[index][2];
    palette_output[offset + 3u] = 255;
  }

  return 0;
}
